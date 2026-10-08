import { describe, expect, it } from 'vitest';
import { dispatch, previewNext, replyOptions, textOf, type Action } from './engine';
import { initialState } from './init';
import { getSlot } from './slots';
import { DAY } from './time';
import { groupOf, statusOf } from './view';
import type { State } from './types';

const run = (s: State, ...actions: Action[]) => actions.reduce(dispatch, s);
const coord = (s: State, id: string) => s.messages.filter((m) => m.caseId === id && m.from === 'coordinator');
const firstSlot = (s: State, id: string, prefix = 'slot:') => replyOptions(s, id).find((o) => o.id.startsWith(prefix))!.id;
const jump = (s: State, caseId: string) => dispatch(s, { type: 'jumpNext', caseId });
const groups = (s: State) => {
  const out: Record<string, string[]> = {};
  for (const id of s.caseOrder) (out[groupOf(s.cases[id])] ??= []).push(id);
  return out;
};

describe('seeded practice', () => {
  const s = initialState();
  it('matches the agreed overview', () => {
    const g = groups(s);
    expect(g.attention?.sort()).toEqual(['elena', 'omar']);
    expect(g.booked?.sort()).toEqual(['hana', 'robert', 'sam']);
    expect(g.progress?.sort()).toEqual(['aisha', 'daniel', 'james', 'leo', 'maya', 'nora']);
    expect(statusOf(s, s.cases.omar)).toMatchObject({ text: 'Asked what it will cost', tag: 'Front desk' });
    expect(statusOf(s, s.cases.elena)).toMatchObject({ text: 'Has a clinical question', tag: 'Dr. Bell' });
    expect(statusOf(s, s.cases.james).text).toBe('Not replying');
    expect(statusOf(s, s.cases.maya).text).toBe('Choosing a time');
    expect(statusOf(s, s.cases.nora).text).toBe('Not contacted yet');
  });
  it('every booking is in the future and on the treating dentist’s book', () => {
    for (const a of Object.values(s.appointments)) {
      expect(a.start).toBeGreaterThan(s.now);
      expect(a.providerId).toBe(s.cases[a.caseId].providerId);
    }
  });
});

describe('drafted next message', () => {
  it('preview is exactly what gets sent', () => {
    const s = initialState();
    for (const id of ['maya', 'james', 'nora', 'robert']) {
      const pv = previewNext(s, id)!;
      const after = jump(s, id);
      const sent = coord(after, id).filter((m) => m.at >= pv.at);
      expect(sent.length).toBeGreaterThan(0);
      expect(textOf(sent[0].parts)).toBe(textOf(pv.message!.parts));
    }
  });
  it('send now sends the draft immediately, once', () => {
    let s = initialState();
    const n = coord(s, 'nora').length;
    const key = s.cases.nora.next!.key;
    s = run(s, { type: 'sendNow', caseId: 'nora', key }, { type: 'sendNow', caseId: 'nora', key });
    expect(coord(s, 'nora').length).toBe(n + 1);
  });
});

describe('channels', () => {
  it('emails patients who prefer email', () => {
    const s = jump(initialState(), 'leo');
    const m = coord(s, 'leo')[0];
    expect(m.channel).toBe('email');
    expect(textOf(m.parts)).toContain('unsubscribe');
  });
});

describe('front-desk hold', () => {
  it('suppresses outreach until marked as called', () => {
    let s = initialState();
    expect(s.cases.omar.next).toBeUndefined();
    const n = coord(s, 'omar').length;
    s = run(s, { type: 'advance', ms: 10 * DAY });
    expect(coord(s, 'omar').length).toBe(n);
    expect(groupOf(s.cases.omar)).toBe('attention');
    s = run(s, { type: 'resolveHold', caseId: 'omar' });
    expect(s.cases.omar.hold).toBeUndefined();
    expect(s.cases.omar.next?.type).toBe('followup');
    expect(groupOf(s.cases.omar)).toBe('progress');
  });
});

describe('main journey: Maya', () => {
  it('books, recovers from cancellation, pauses, rebooks, completes', () => {
    let s = initialState();
    const why = coord(s, 'maya').find((m) => m.tag === 'Explanation')!;
    expect(why.parts.map((p) => p.src).filter(Boolean)).toEqual(['chart', 'faq']);

    s = run(s, { type: 'reply', caseId: 'maya', optionId: firstSlot(s, 'maya') });
    expect(groupOf(s.cases.maya)).toBe('booked');

    s = run(s, { type: 'practiceCancel', caseId: 'maya' });
    expect(s.cases.maya.stage).toBe('offering');
    const cancelled = Object.values(s.appointments).find((a) => a.caseId === 'maya')!;
    for (const o of replyOptions(s, 'maya').filter((x) => x.group === 'slot')) {
      expect(new Date(getSlot(o.id.split(':')[1])!.start).toDateString()).not.toBe(new Date(cancelled.start).toDateString());
    }

    s = run(s, { type: 'reply', caseId: 'maya', optionId: 'pause_week' });
    expect(s.cases.maya.status).toBe('paused');
    const n = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 3 * DAY });
    expect(coord(s, 'maya').length).toBe(n);

    s = jump(s, 'maya');
    expect(coord(s, 'maya').at(-1)!.tag).toBe('Check-back');
    s = run(s, { type: 'reply', caseId: 'maya', optionId: firstSlot(s, 'maya') });
    s = jump(s, 'maya'); // reminder
    expect(coord(s, 'maya').at(-1)!.tag).toBe('Reminder');
    s = jump(s, 'maya'); // visit time passes
    expect(s.cases.maya.status).toBe('visit_passed');
    s = run(s, { type: 'recordCompletion', caseId: 'maya' });
    expect(groupOf(s.cases.maya)).toBe('closed');
    const m = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 60 * DAY }, { type: 'recordCompletion', caseId: 'maya' });
    expect(coord(s, 'maya').length).toBe(m);
  });
});

describe('rules', () => {
  it('caps unanswered outreach at the first message + 2 follow-ups', () => {
    const s = run(initialState(), { type: 'advance', ms: 12 * DAY });
    expect(coord(s, 'james').filter((m) => m.tag?.startsWith('Follow-up'))).toHaveLength(2);
    expect(s.cases.james.status).toBe('no_response');
  });
  it('stop cancels all future outreach', () => {
    let s = run(initialState(), { type: 'reply', caseId: 'daniel', optionId: 'stop' });
    const n = coord(s, 'daniel').length;
    s = run(s, { type: 'advance', ms: 30 * DAY });
    expect(coord(s, 'daniel').length).toBe(n);
  });
  it('replaying an event creates no duplicates', () => {
    let s = run(initialState(), { type: 'advance', ms: DAY });
    const m = s.messages.length;
    s = run(s, { type: 'replayLast' }, { type: 'replayLast' });
    expect(s.messages.length).toBe(m);
  });
  it('double-tapping a time books once', () => {
    let s = initialState();
    const slot = firstSlot(s, 'daniel');
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: slot }, { type: 'reply', caseId: 'daniel', optionId: slot });
    expect(Object.values(s.appointments).filter((a) => a.caseId === 'daniel')).toHaveLength(1);
  });
  it('staff pause stops outreach until the check-back', () => {
    let s = run(initialState(), { type: 'staffPause', caseId: 'james' });
    expect(s.cases.james.status).toBe('paused');
    const n = coord(s, 'james').length;
    s = run(s, { type: 'advance', ms: 5 * DAY });
    expect(coord(s, 'james').length).toBe(n);
  });
});

describe('clarification: Elena', () => {
  it('records the dentist’s note after the call and leaves the decision to her', () => {
    const s = jump(jump(initialState(), 'elena'), 'elena'); // call reminder, then the check-in after the call
    expect(s.cases.elena.stage).toBe('post_consult');
    expect(s.notes['note-elena-consult']).toBeDefined();
    expect(replyOptions(s, 'elena').map((o) => o.id)).toContain('proceed');
  });
});

describe('knowledge preview', () => {
  it('composes the real reply for each kind of FAQ entry', async () => {
    const { previewAnswer } = await import('./engine');
    const s = initialState();
    expect(previewAnswer(s, 'maya', 'why')!.parts.map((p) => p.src).filter(Boolean)).toEqual(['chart', 'faq']);
    expect(textOf(previewAnswer(s, 'maya', 'q:alt')!.parts)).toContain('call with Dr. Shah');
    expect(textOf(previewAnswer(s, 'maya', 'cost')!.parts)).toContain('front desk');
    expect(textOf(previewAnswer(s, 'james', 'q:hurt')!.parts)).toContain('numbed');
  });
});

describe('no invented clinical facts', () => {
  it('never previews a message that quotes a note that doesn’t exist yet', () => {
    let s = initialState();
    // Elena's next step is the call reminder; after it, the check-in that quotes the call note.
    expect(previewNext(s, 'elena')!.label).toBe('Call reminder');
    s = jump(s, 'elena');
    const pv = previewNext(s, 'elena')!;
    expect(pv.message).toBeUndefined();
    expect(s.notes['note-elena-consult']).toBeUndefined();
  });
  it('sync time moves with the clock', () => {
    const s = run(initialState(), { type: 'advance', ms: DAY });
    expect(s.lastSync).toBeGreaterThan(initialState().lastSync);
    expect(s.lastSync).toBeLessThanOrEqual(s.now);
  });
});

describe('editing FAQ files', () => {
  it('round-trips markdown and changes the replies the coordinator sends', async () => {
    const { toMarkdown } = await import('./faqmd');
    const { previewAnswer } = await import('./engine');
    let s = initialState();
    const md = toMarkdown(s.faqs.crowns);
    s = run(s, { type: 'editFaq', fileId: 'crowns', md });
    expect(s.faqs.crowns.entries.map((e) => e.key)).toEqual(['why', 'last', 'alt', 'wait']);
    s = run(s, { type: 'editFaq', fileId: 'crowns', md: md.replace('Most last 10–15 years', 'Most crowns last 15 years or more') });
    expect(textOf(previewAnswer(s, 'maya', 'q:last')!.parts)).toContain('15 years or more');
  });
});
