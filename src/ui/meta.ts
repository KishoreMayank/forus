import type { Barrier, Case, CaseStatus, State } from '../domain/types';
import { currentAppointment } from '../domain/engine';
import { fmtDateTime } from '../domain/time';

export type Tone = 'blue' | 'amber' | 'green' | 'violet' | 'gray' | 'teal';

export const STATUS: Record<CaseStatus, { label: string; tone: Tone; help: string }> = {
  awaiting_reply: { label: 'Waiting for reply', tone: 'blue', help: 'A message is out; the coordinator is waiting on the patient.' },
  paused: { label: 'Paused', tone: 'amber', help: 'Patient asked us to check back later. No messages until then.' },
  consult_booked: { label: 'Dentist discussion', tone: 'violet', help: 'A discussion with the dentist is booked. Treatment decision pending.' },
  booked: { label: 'Booked', tone: 'teal', help: 'Treatment appointment is on the schedule.' },
  visit_passed: { label: 'Awaiting completion', tone: 'teal', help: 'Visit time passed. Waiting for the practice record to confirm completion.' },
  completed: { label: 'Completed', tone: 'green', help: 'Practice record confirms treatment complete.' },
  declined: { label: 'Declined', tone: 'gray', help: 'Patient decided not to proceed.' },
  opted_out: { label: 'Opted out', tone: 'gray', help: 'Patient stopped messages.' },
  no_response: { label: 'No response', tone: 'gray', help: 'Outreach cap reached with no reply. A reply reopens the case.' },
};

export const BARRIER: Record<Barrier, string> = {
  unknown: 'Not yet known',
  understanding: 'Treatment understanding',
  scheduling: 'Scheduling',
};

export type Filter = 'all' | 'waiting' | 'paused' | 'booked' | 'completed' | 'closed';

export const FILTERS: { id: Filter; label: string; match: (c: Case) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'waiting', label: 'Waiting for reply', match: (c) => c.status === 'awaiting_reply' },
  { id: 'paused', label: 'Paused', match: (c) => c.status === 'paused' },
  { id: 'booked', label: 'Booked', match: (c) => ['booked', 'consult_booked', 'visit_passed'].includes(c.status) },
  { id: 'completed', label: 'Completed', match: (c) => c.status === 'completed' },
  { id: 'closed', label: 'Closed', match: (c) => ['declined', 'opted_out', 'no_response'].includes(c.status) },
];

/** What happens next for a case, in plain language. */
export function nextActionText(s: State, c: Case): { label: string; at?: number } {
  if (c.next) return { label: c.next.label, at: c.next.at };
  switch (c.status) {
    case 'visit_passed':
      return { label: 'Waiting for completion record' };
    case 'completed':
      return { label: 'None · case closed' };
    case 'declined':
      return { label: 'None · patient declined' };
    case 'opted_out':
      return { label: 'None · messages stopped' };
    case 'no_response':
      return { label: 'None · reopens if patient replies' };
    default: {
      const a = currentAppointment(s, c);
      return a ? { label: 'Appointment', at: a.start } : { label: '—' };
    }
  }
}

export function apptLabel(type: 'crown_prep' | 'consult') {
  return type === 'consult' ? 'Dentist discussion · 20 min' : 'Crown preparation · 90 min';
}

export { fmtDateTime };
