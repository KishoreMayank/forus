import type { Case, State } from './types';
import { TREATMENTS } from './catalog';
import { currentAppointment } from './engine';
import { DAY, fmtDM, fmtTime, fmtWDM, startOfDay } from './time';

// What the screen shows per patient, derived from engine state only.
// The list, the panel and the counts all read from here, so they can't disagree.

export type Group = 'attention' | 'progress' | 'booked' | 'closed';
export type Dot = 'live' | 'new' | 'paused' | 'attention' | 'booked' | 'closed';

export const GROUP_LABEL: Record<Group, string> = {
  attention: 'Needs attention', progress: 'In progress', booked: 'Booked', closed: 'Closed',
};

/** "today, 9:12" · "yesterday" · "Fri" · "9 Oct" relative to the practice clock. */
export function rel(t: number, now: number, withTime = true): string {
  const d = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  const time = fmtTime(t);
  if (d === 0) return withTime ? `today, ${time}` : 'today';
  if (d === -1) return withTime ? `yesterday, ${time}` : 'yesterday';
  if (d === 1) return withTime ? `tomorrow, ${time}` : 'tomorrow';
  if (d > 1 && d < 7) return withTime ? `${fmtWDM(t).slice(0, 3)}, ${time}` : fmtWDM(t).slice(0, 3);
  return withTime ? `${fmtWDM(t)}, ${time}` : fmtWDM(t);
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function groupOf(c: Case): Group {
  if (['completed', 'declined', 'opted_out', 'no_response'].includes(c.status)) return 'closed';
  if (c.hold || c.status === 'consult_booked' || c.stage === 'handoff_offer') return 'attention';
  if (c.status === 'booked' || c.status === 'visit_passed') return 'booked';
  return 'progress';
}

export function statusOf(s: State, c: Case): { text: string; tag?: string; dot: Dot } {
  const provider = s.providers[c.providerId];
  const msgs = s.messages.filter((m) => m.caseId === c.id);
  const replied = msgs.some((m) => m.from === 'patient');
  if (c.hold) return { text: c.hold.reason, tag: 'Front desk', dot: 'attention' };
  switch (c.status) {
    case 'completed': return { text: 'Treatment complete', dot: 'closed' };
    case 'declined': return { text: 'Decided not to go ahead', dot: 'closed' };
    case 'opted_out': return { text: 'Opted out of messages', dot: 'closed' };
    case 'no_response': return { text: 'No response', dot: 'closed' };
    case 'consult_booked': return { text: 'Has a clinical question', tag: provider.short, dot: 'attention' };
    case 'paused': return { text: `Paused until ${fmtDM(c.pausedUntil ?? s.now)}`, dot: 'paused' };
    case 'visit_passed': return { text: 'Visit done · awaiting completion', dot: 'booked' };
    case 'booked': {
      const a = currentAppointment(s, c);
      return { text: a ? `Booked · ${fmtWDM(a.start)}, ${fmtTime(a.start)}` : 'Booked', dot: 'booked' };
    }
  }
  if (c.stage === 'handoff_offer') return { text: 'Has a clinical question', tag: provider.short, dot: 'attention' };
  if (!msgs.length) return { text: 'Not contacted yet', dot: 'new' };
  if (c.stage === 'post_consult') return { text: 'Deciding after the call', dot: 'live' };
  if (c.stage === 'offering' || c.stage === 'consult_offering') return { text: 'Choosing a time', dot: 'live' };
  if (!replied) return { text: c.nudgesSent > 0 ? 'Not replying' : 'Waiting for a reply', dot: 'live' };
  return { text: 'Asking questions', dot: 'live' };
}

export function lastHeard(s: State, c: Case): string {
  const msgs = s.messages.filter((m) => m.caseId === c.id);
  const lastPt = [...msgs].reverse().find((m) => m.from === 'patient');
  if (lastPt) return `Replied ${rel(lastPt.at, s.now)}`;
  if (!msgs.length) return '—';
  const days = Math.floor((s.now - msgs[0].at) / DAY);
  return days >= 1 ? `No reply · ${days} day${days === 1 ? '' : 's'}` : 'No reply yet';
}

export function nextStep(s: State, c: Case): { when: string; what: string } | null {
  if (c.hold) return { when: 'Now', what: 'front desk to call' };
  if (c.status === 'consult_booked') {
    const a = currentAppointment(s, c);
    if (a) return { when: rel(a.start, s.now), what: `call with ${s.providers[c.providerId].short}` };
  }
  if (c.status === 'visit_passed') return { when: 'Waiting', what: 'treatment history to show it complete' };
  if (!c.next) return null;
  return { when: cap(rel(c.next.at, s.now)), what: c.next.label.toLowerCase() };
}

export function systemsOf(s: State, c: Case): [string, string][] {
  const p = s.patients[c.patientId];
  const a = currentAppointment(s, c);
  const sched = !a ? 'Nothing booked'
    : a.type === 'consult' ? `Call · ${fmtWDM(a.start)}, ${fmtTime(a.start)}`
    : `${a.status === 'completed' ? 'Done' : 'Booked'} · ${fmtWDM(a.start)}, ${fmtTime(a.start)}`;
  const contact = c.status === 'opted_out' ? 'Opted out'
    : c.hold ? 'Paused for front desk'
    : c.status === 'paused' ? 'Paused at their request'
    : ['completed', 'declined', 'no_response'].includes(c.status) ? 'No further messages'
    : 'Allowed';
  return [
    ['Treatment history', c.status === 'completed' ? 'Completed' : 'Not completed'],
    ['Scheduling', sched],
    [p.channel === 'email' ? 'Email' : 'Text messages', contact],
  ];
}

/** First clause of an explanation, for one-line activity details. */
const short = (why: string) => {
  const first = why.split(/(?<=(?<!Dr|Mr|Ms|Mrs)\.)\s/)[0].replace(/\.$/, '');
  return first.length > 70 ? first.slice(0, 68).replace(/\s\S*$/, '') + '…' : first;
};

const SHOWN = ['found', 'outreach', 'explanation', 'schedule', 'booking', 'cancellation', 'pause', 'resume', 'handoff', 'completion', 'closed', 'record', 'message'];

export function activityOf(s: State, c: Case, limit = 5): { at: string; title: string; detail: string }[] {
  const rec = s.recommendations[c.recommendationId];
  const tx = TREATMENTS[rec.treatment];
  const items = [
    { at: rec.recommendedOn, title: `${tx.label} recommended`, detail: `${s.providers[c.providerId].short} · from the chart` },
    ...s.events.filter((e) => e.caseId === c.id && SHOWN.includes(e.kind)).map((e) => ({ at: e.at, title: e.title, detail: short(e.why) })),
  ];
  return items.slice(-limit).map((i) => ({ ...i, at: rel(i.at, s.now, false) === 'today' ? fmtTime(i.at) : cap(rel(i.at, s.now, false)) }));
}

/** Order within a group: longest without a reply first, booked by date. */
export function sortCases(s: State, cases: Case[], group: Group): Case[] {
  const lastPt = (c: Case) => {
    const m = [...s.messages].reverse().find((x) => x.caseId === c.id && x.from === 'patient');
    return m ? m.at : (s.messages.find((x) => x.caseId === c.id)?.at ?? Infinity);
  };
  if (group === 'booked') return [...cases].sort((a, b) => (currentAppointment(s, a)?.start ?? 0) - (currentAppointment(s, b)?.start ?? 0));
  if (group === 'progress') {
    const rank = (c: Case) => (c.status === 'paused' ? 2 : statusOf(s, c).dot === 'new' ? 1 : 0);
    return [...cases].sort((a, b) => rank(a) - rank(b) || lastPt(a) - lastPt(b));
  }
  return cases;
}

/** Which scripted reply would ask this FAQ question, for a given patient (null if it's not a patient question). */
export function optionForFaq(s: State, c: Case, fileId: string, key: string): string | null {
  const tx = TREATMENTS[s.recommendations[c.recommendationId].treatment];
  if (fileId === tx.faq) return key === 'why' ? 'why' : `q:${key}`;
  if (fileId === 'the-appointment' && key === 'visit') return 'visit';
  if (fileId === 'costs' && key === 'cost') return 'cost';
  if (fileId === 'scheduling') return 'book';
  return null;
}

/** How many sent messages quote an FAQ entry. */
export function faqUses(s: State, ref: string): number {
  return s.messages.filter((m) => m.parts.some((p) => p.ref === ref)).length;
}
