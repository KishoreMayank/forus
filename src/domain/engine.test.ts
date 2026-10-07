import { describe, expect, it } from 'vitest';
import { canPracticeCancel, dispatch, replyOptions, tick, type Action } from './engine';
import { initialState } from './init';
import { DAY } from './time';
import { getSlot } from './slots';
import type { State } from './types';

const run = (s: State, ...actions: Action[]) => actions.reduce(dispatch, s);
const msgs = (s: State, id: string) => s.messages.filter((m) => m.caseId === id);
const coord = (s: State, id: string) => msgs(s, id).filter((m) => m.from === 'coordinator');
const firstSlot = (s: State, id: string, prefix = 'slot:') => replyOptions(s, id).find((o) => o.id.startsWith(prefix))!.id;
const jump = (s: State, caseId: string) => dispatch(s, { type: 'jumpNext', caseId });

describe('automatic outreach', () => {
  it('sends the first message on start, without approval, exactly once', () => {
    const s = initialState();
    expect(coord(s, 'maya')).toHaveLength(1);
    expect(coord(s, 'maya')[0].tag).toBe('First outreach');
    expect(s.cases.maya.status).toBe('awaiting_reply');
    expect(s.cases.maya.next?.type).toBe('followup');
    // processing the same moment again creates nothing new
    tick(s, s.now);
    const again = dispatch(s, { type: 'advance', ms: 0 });
    expect(coord(again, 'maya')).toHaveLength(1);
  });
});

describe('main journey: Maya', () => {
  it('explains, books, recovers from cancellation, pauses, rebooks, completes', () => {
    let s = initialState();
    s = run(s, { type: 'reply', caseId: 'maya', optionId: 'why' });
    const expl = coord(s, 'maya').at(-1)!;
    expect(expl.sections?.map((x) => x.kind)).toEqual(['clinician', 'general']);
    expect(expl.sources).toEqual({ kbIds: ['kb-crown'], noteIds: ['note-maya'] });
    expect(s.cases.maya.barrier).toBe('understanding');

    s = run(s, { type: 'reply', caseId: 'maya', optionId: 'book' });
    const slots = replyOptions(s, 'maya').filter((o) => o.group === 'slot');
    expect(slots.length).toBe(3);
    // Maya prefers mornings
    for (const o of slots) expect(new Date(getSlot(o.id.split(':')[1])!.start).getHours()).toBeLessThan(12);

    s = run(s, { type: 'reply', caseId: 'maya', optionId: firstSlot(s, 'maya') });
    expect(s.cases.maya.status).toBe('booked');
    expect(s.cases.maya.next?.type).toBe('reminder');
    expect(canPracticeCancel(s, 'maya')).toBe(true);

    s = run(s, { type: 'practiceCancel', caseId: 'maya' });
    expect(s.cases.maya.status).toBe('awaiting_reply');
    expect(s.cases.maya.stage).toBe('offering');
    expect(coord(s, 'maya').at(-1)!.tag).toBe('Cancellation recovery');
    const cancelledDay = new Date(Object.values(s.appointments).find((a) => a.caseId === 'maya')!.start).toDateString();
    for (const o of replyOptions(s, 'maya').filter((x) => x.group === 'slot')) {
      expect(new Date(getSlot(o.id.split(':')[1])!.start).toDateString()).not.toBe(cancelledDay);
    }

    s = run(s, { type: 'reply', caseId: 'maya', optionId: 'pause_week' });
    expect(s.cases.maya.status).toBe('paused');
    const resumeAt = s.cases.maya.next!.at;
    expect(resumeAt - s.now).toBeGreaterThan(6 * DAY);

    // Advance 3 days: nothing sent during the pause
    const before = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 3 * DAY });
    expect(coord(s, 'maya').length).toBe(before);

    s = jump(s, 'maya');
    expect(s.now).toBe(resumeAt);
    expect(s.cases.maya.status).toBe('awaiting_reply');
    expect(coord(s, 'maya').at(-1)!.tag).toBe('Check-back with new times');

    s = run(s, { type: 'reply', caseId: 'maya', optionId: firstSlot(s, 'maya') });
    expect(s.cases.maya.status).toBe('booked');
    s = jump(s, 'maya'); // reminder
    expect(coord(s, 'maya').at(-1)!.tag).toBe('Reminder sent');
    s = jump(s, 'maya'); // visit time passes
    expect(s.cases.maya.status).toBe('visit_passed'); // attendance is not completion

    s = run(s, { type: 'recordCompletion', caseId: 'maya' });
    expect(s.cases.maya.status).toBe('completed');
    expect(s.cases.maya.next).toBeUndefined();
    const n = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 60 * DAY }, { type: 'recordCompletion', caseId: 'maya' });
    expect(coord(s, 'maya').length).toBe(n);
  });
});

describe('rules', () => {
  it('caps unanswered outreach at initial + 2 follow-ups', () => {
    let s = initialState();
    s = run(s, { type: 'advance', ms: 40 * DAY });
    const tags = coord(s, 'daniel').map((m) => m.tag);
    expect(tags).toEqual(['First outreach', 'Follow-up 1 of 2', 'Follow-up 2 of 2']);
    expect(s.cases.daniel.status).toBe('no_response');
    expect(s.cases.daniel.next).toBeUndefined();
  });

  it('a reply reopens a no-response case', () => {
    let s = run(initialState(), { type: 'advance', ms: 40 * DAY });
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: 'book' });
    expect(s.cases.daniel.status).toBe('awaiting_reply');
  });

  it('existing booking suppresses scheduling messages', () => {
    let s = initialState();
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: 'book' });
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: firstSlot(s, 'daniel') });
    const n = coord(s, 'daniel').length;
    s = run(s, { type: 'advance', ms: 2 * DAY });
    // only a reminder may be sent before the visit
    expect(coord(s, 'daniel').slice(n).every((m) => m.tag === 'Reminder sent')).toBe(true);
  });

  it('cancellation does not message a paused or opted-out patient', () => {
    let s = initialState();
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: 'book' });
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: firstSlot(s, 'daniel') });
    s = run(s, { type: 'reply', caseId: 'daniel', optionId: 'stop' });
    const n = coord(s, 'daniel').length;
    s = run(s, { type: 'practiceCancel', caseId: 'daniel' }, { type: 'advance', ms: 30 * DAY });
    expect(coord(s, 'daniel').length).toBe(n);
    expect(s.cases.daniel.status).toBe('opted_out');
  });

  it('stop cancels all future outreach', () => {
    let s = run(initialState(), { type: 'reply', caseId: 'maya', optionId: 'stop' });
    const n = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 60 * DAY });
    expect(coord(s, 'maya').length).toBe(n);
    expect(replyOptions(s, 'maya').map((o) => o.id)).toEqual(['start']);
  });

  it('decline closes the case and respects the decision', () => {
    let s = run(initialState(), { type: 'reply', caseId: 'maya', optionId: 'decline' });
    expect(s.cases.maya.status).toBe('declined');
    const n = coord(s, 'maya').length;
    s = run(s, { type: 'advance', ms: 60 * DAY });
    expect(coord(s, 'maya').length).toBe(n);
  });

  it('replaying the last event creates no duplicates', () => {
    let s = run(initialState(), { type: 'advance', ms: 4 * DAY });
    const m = s.messages.length;
    const appts = Object.keys(s.appointments).length;
    s = run(s, { type: 'replayLast' }, { type: 'replayLast' });
    expect(s.messages.length).toBe(m);
    expect(Object.keys(s.appointments).length).toBe(appts);
    expect(s.events.filter((e) => e.kind === 'duplicate').length).toBe(2);
  });

  it('stale taps are ignored (double-tap a slot books once)', () => {
    let s = run(initialState(), { type: 'reply', caseId: 'maya', optionId: 'book' });
    const slot = firstSlot(s, 'maya');
    s = run(s, { type: 'reply', caseId: 'maya', optionId: slot }, { type: 'reply', caseId: 'maya', optionId: slot });
    expect(Object.values(s.appointments).filter((a) => a.caseId === 'maya')).toHaveLength(1);
  });
});

describe('clarification: Elena', () => {
  it('routes an unanswerable question to the dentist and leaves treatment incomplete', () => {
    let s = initialState();
    s = run(s, { type: 'reply', caseId: 'elena', optionId: 'why' }, { type: 'reply', caseId: 'elena', optionId: 'alt' });
    const handoffMsg = coord(s, 'elena').at(-1)!;
    expect(handoffMsg.sections?.[0].kind).toBe('notice');
    expect(s.cases.elena.stage).toBe('handoff_offer');

    s = run(s, { type: 'reply', caseId: 'elena', optionId: 'consult_yes' });
    expect(Object.values(s.handoffs)).toHaveLength(1);
    s = run(s, { type: 'reply', caseId: 'elena', optionId: firstSlot(s, 'elena', 'consult_slot:') });
    expect(s.cases.elena.status).toBe('consult_booked');
    expect(s.cases.elena.appointmentId).toBeUndefined();

    s = jump(s, 'elena');
    expect(s.cases.elena.stage).toBe('post_consult');
    expect(s.notes['note-elena-consult']).toBeDefined();
    expect(replyOptions(s, 'elena').map((o) => o.id)).toContain('proceed');
    expect(s.cases.elena.status).not.toBe('completed');
  });
});
