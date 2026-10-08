import type {
  Appointment, Case, CaseEvent, CaseStatus, FaqEntry, Message, Part, ReplyOption, Slot, State, Wake, WakeType,
} from './types';
import { TREATMENTS } from './catalog';
import { fromMarkdown } from './faqmd';
import { CONSULT_NOTES, PRACTICE } from './seed';
import { dayKey, findSlots, getSlot, isBookable } from './slots';
import { DAY, HOUR, MIN, addDays, fmtDM, fmtDateTime, fmtTime, fmtWDM, nextContactTime, nextWeek, withTime } from './time';

// ─────────────────────────────────────────────────────────────────────────────
// The coordinator loop
//   Observe  → read the plan, appointments, contact permission, latest reply
//   Decide   → pick the next permitted action from the case state
//   Act      → send a message, offer or book a slot, schedule a wake-up
//   Remember → persist barrier, preferences, actions, and the next wake-up
//   Resume   → wake on a reply, a requested date, a cancellation, or a record update
//   Close    → stop on completion, decline, opt-out, or the outreach cap
// All transitions are deterministic. Every outbound message and every wake-up
// carries an idempotency key, so replaying an event can never duplicate work.
// ─────────────────────────────────────────────────────────────────────────────

export const FOLLOWUP_GAPS = [3 * DAY, 4 * DAY]; // after initial, after follow-up 1
export const CLOSE_AFTER = 7 * DAY; // after follow-up 2 with no reply
export const MAX_FOLLOWUPS = 2;

export const OPEN_STATUSES: CaseStatus[] = ['awaiting_reply', 'paused', 'consult_booked', 'booked', 'visit_passed'];
export const isOpen = (c: Case) => OPEN_STATUSES.includes(c.status);
const canContact = (c: Case) => c.status !== 'opted_out';

export type Action =
  | { type: 'reply'; caseId: string; optionId: string }
  | { type: 'advance'; ms: number }
  | { type: 'advanceTo'; at: number }
  | { type: 'jumpNext'; caseId?: string }
  | { type: 'practiceCancel'; caseId: string }
  | { type: 'recordCompletion'; caseId: string }
  | { type: 'sendNow'; caseId: string; key: string }
  | { type: 'staffPause'; caseId: string }
  | { type: 'resolveHold'; caseId: string }
  | { type: 'sync' }
  | { type: 'editFaq'; fileId: string; md: string }
  | { type: 'replayLast' };

// ── message parts ────────────────────────────────────────────────────────────

const T = (t: string): Part => ({ t });
const C = (t: string, ref: string): Part => ({ t, src: 'chart', ref });
const F = (t: string, ref: string): Part => ({ t, src: 'faq', ref });
export const textOf = (parts: Part[]) => parts.map((p) => p.t).join('');

// ── small helpers ────────────────────────────────────────────────────────────

const ctx = (s: State, c: Case) => {
  const patient = s.patients[c.patientId];
  const rec = s.recommendations[c.recommendationId];
  const provider = s.providers[c.providerId];
  const note = s.notes[rec.noteId];
  const tx = TREATMENTS[rec.treatment];
  return { patient, rec, provider, note, tx, first: patient.firstName };
};

export function faq(s: State, fileId: string, key: string): FaqEntry | undefined {
  return s.faqs[fileId]?.entries.find((e) => e.key === key);
}

function nextId(s: State, prefix: string) {
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}

function event(s: State, c: Case, actor: CaseEvent['actor'], kind: CaseEvent['kind'], title: string, why: string, refs?: CaseEvent['refs']) {
  s.events.push({ id: nextId(s, 'e'), caseId: c.id, at: s.now, actor, kind, title, why, refs });
}

/** Send a coordinator message exactly once per key. */
function send(s: State, c: Case, key: string, parts: Part[], tag?: string): boolean {
  if (s.processedKeys[key] || !canContact(c)) return false;
  s.processedKeys[key] = s.now;
  const channel = s.patients[c.patientId].channel;
  s.messages.push({ id: nextId(s, 'm'), key, caseId: c.id, from: 'coordinator', channel, at: s.now, parts, tag });
  for (const p of parts) {
    if (p.src === 'faq' && p.ref && !c.faqRefs.includes(p.ref)) c.faqRefs.push(p.ref);
    if (p.src === 'chart' && p.ref && !c.noteRefs.includes(p.ref)) c.noteRefs.push(p.ref);
  }
  return true;
}

function schedule(s: State, c: Case, type: WakeType, atTime: number, label: string) {
  c.next = { type, at: atTime, key: `wake:${type}:${c.id}:${nextId(s, 'w')}`, label };
}

/** Cancel a pending wake-up, logging why it was suppressed. */
function suppressPending(s: State, c: Case, reason: string, onlyTypes?: WakeType[]) {
  const n = c.next;
  if (!n || (onlyTypes && !onlyTypes.includes(n.type))) return;
  c.next = undefined;
  if (['outreach', 'followup', 'resume'].includes(n.type)) {
    const what = n.type === 'resume' ? 'Check-back' : n.type === 'outreach' ? 'First message' : 'Follow-up';
    event(s, c, 'coordinator', 'suppressed', `${what} planned for ${fmtWDM(n.at)} cancelled`, reason);
  }
}

function scheduleFollowup(s: State, c: Case) {
  if (c.hold) return; // a person is handling it; no automated nudges meanwhile
  const gap = FOLLOWUP_GAPS[Math.min(c.nudgesSent, FOLLOWUP_GAPS.length - 1)];
  const n = c.nudgesSent + 1;
  schedule(s, c, 'followup', nextContactTime(withTime(s.now + gap, 10)), n === MAX_FOLLOWUPS ? 'Last follow-up' : 'Follow-up');
}

function activeAppt(s: State, c: Case): Appointment | undefined {
  const a = c.appointmentId ? s.appointments[c.appointmentId] : undefined;
  return a && a.status === 'booked' ? a : undefined;
}

function activeConsult(s: State, c: Case): Appointment | undefined {
  const a = c.consultAppointmentId ? s.appointments[c.consultAppointmentId] : undefined;
  return a && a.status === 'booked' ? a : undefined;
}

const slotLines = (slots: Slot[]) => slots.map((sl) => `• ${fmtWDM(sl.start)}, ${fmtTime(sl.start)}`).join('\n');
const dur = (min: number) => (min >= 120 ? `${min / 60} hours` : `${min} minutes`);

function offer(s: State, c: Case, type: Slot['type'], mode: 'preferred' | 'more'): Slot[] {
  const { patient } = ctx(s, c);
  let slots: Slot[];
  if (mode === 'more') {
    const last = c.offeredSlotIds.map(getSlot).filter(Boolean).reduce((m, sl) => Math.max(m, sl!.start), s.now);
    slots = findSlots(s, { providerId: c.providerId, type, pref: 'any', after: last });
  } else {
    slots = findSlots(s, { providerId: c.providerId, type, pref: type === 'consult' ? 'any' : patient.timePreference });
    if (slots.length < 3) slots = findSlots(s, { providerId: c.providerId, type });
  }
  c.offeredSlotIds = slots.map((sl) => sl.id);
  return slots;
}

function cancelAppointment(s: State, a: Appointment, reason: string) {
  a.status = 'cancelled';
  a.cancelledReason = reason;
  delete s.bookedSlots[a.slotId];
}

/** Questions a patient can ask, from the treatment's FAQ file (other than "why", which also uses the chart). */
function treatmentQuestions(s: State, c: Case): FaqEntry[] {
  const { tx } = ctx(s, c);
  return (s.faqs[tx.faq]?.entries ?? []).filter((e) => e.key !== 'why');
}

// ── reply options: generated from the case state, never from a fixed script ─

const MORE: Record<string, ReplyOption> = {
  pause_week: { id: 'pause_week', label: 'Check back next week', group: 'more' },
  pause_month: { id: 'pause_month', label: 'Check back in a month', group: 'more' },
  decline: { id: 'decline', label: 'I’ve decided not to go ahead', group: 'more' },
  stop: { id: 'stop', label: 'Stop messages', group: 'more' },
};

export function replyOptions(s: State, caseId: string): ReplyOption[] {
  const c = s.cases[caseId];
  if (!c) return [];
  const p = (id: string, label: string): ReplyOption => ({ id, label, group: 'primary' });
  const more = (...ids: string[]) => ids.map((id) => MORE[id]);
  const askable = (id: string, label: string) => (c.asked.includes(id) ? [] : [p(id, label)]);
  const slotOpts = (prefix: string) =>
    c.offeredSlotIds
      .map(getSlot)
      .filter((sl): sl is Slot => !!sl && isBookable(s, sl))
      .map<ReplyOption>((sl) => ({ id: `${prefix}${sl.id}`, label: `${fmtWDM(sl.start)}, ${fmtTime(sl.start)}`, group: 'slot' }));
  const questions = () => [
    ...treatmentQuestions(s, c).flatMap((e) => askable(`q:${e.key}`, e.q)),
    ...askable('visit', 'What happens at the appointment?'),
    ...askable('cost', 'How much will it cost?'),
  ];
  const { tx } = ctx(s, c);

  switch (c.status) {
    case 'opted_out':
      return [p('start', 'START')];
    case 'completed':
      return [];
    case 'visit_passed':
      return more('stop');
    case 'declined':
      return [p('reopen', 'Actually, I’d like to schedule'), ...more('stop')];
    case 'no_response':
      return [p('book', 'I’m ready to schedule'), ...askable('why', `Why do I need ${tx.a}?`), ...more('decline', 'stop')];
    case 'paused':
      return [p('ready', 'I’m ready to schedule now'), ...more('decline', 'stop')];
    case 'booked':
      return [...askable('visit', 'What happens at the appointment?'), p('reschedule', 'I need to reschedule'), p('cancel_appt', 'Cancel my appointment'), ...more('stop')];
    case 'consult_booked':
      return [p('reschedule_consult', 'I need to change the call time'), ...more('decline', 'stop')];
  }

  switch (c.stage) {
    case 'offering': {
      const slots = slotOpts('slot:');
      return [...slots, ...(slots.length ? [p('more_times', 'Other times')] : [p('book', 'Show available times')]), p('pause_week', 'Check back next week'), ...questions(), ...more('pause_month', 'decline', 'stop')];
    }
    case 'consult_offering': {
      const slots = slotOpts('consult_slot:');
      return [...slots, ...(slots.length ? [p('more_consult_times', 'Other times')] : [p('consult_yes', 'Show call times')]), ...more('pause_week', 'decline', 'stop')];
    }
    case 'handoff_offer':
      return [p('consult_yes', 'Yes, set up a call'), p('consult_later', 'Let me think about it'), p('consult_no', 'No thanks'), ...more('decline', 'stop')];
    case 'post_consult':
      return [p('proceed', `I’d like to schedule the ${tx.label.toLowerCase()}`), p('pause_week', 'I need more time'), p('decline', 'I’ve decided not to go ahead'), ...more('stop')];
    case 'explained':
      return [p('book', 'Yes, let’s find a time'), ...questions(), ...more('pause_week', 'pause_month', 'decline', 'stop')];
    default:
      return [...askable('why', `Why do I need ${tx.a}?`), p('book', 'I’m ready to schedule'), ...questions(), ...more('pause_week', 'pause_month', 'decline', 'stop')];
  }
}

function patientText(s: State, c: Case, optionId: string, label: string): string {
  const fixed: Record<string, string> = {
    book: 'Yes, let’s find a time', ready: 'I’m ready to schedule now', more_times: 'Do you have other times?',
    more_consult_times: 'Do you have other times?', pause_week: 'Can you check back next week?', pause_month: 'Can you check back in a month?',
    consult_later: 'Let me think about it', consult_yes: 'Yes please, set up a call', consult_no: 'No thanks',
    stop: 'STOP', start: 'START', cancel_appt: 'Please cancel my appointment',
  };
  if (optionId.startsWith('slot:') || optionId.startsWith('consult_slot:')) {
    const sl = getSlot(optionId.split(':')[1])!;
    return `${fmtWDM(sl.start)} at ${fmtTime(sl.start)} works`;
  }
  void s; void c;
  return fixed[optionId] ?? label;
}

// ── patient replies ──────────────────────────────────────────────────────────

function handleReply(s: State, caseId: string, optionId: string) {
  const c = s.cases[caseId];
  if (!c) return;
  const opt = replyOptions(s, caseId).find((o) => o.id === optionId);
  if (!opt) return; // stale or duplicate tap: nothing is created

  const { patient, rec, provider, note, tx, first } = ctx(s, c);
  const replyId = nextId(s, 'r');
  const k = (n: string) => `msg:${c.id}:${replyId}:${n}`;
  s.now += MIN;

  const said = patientText(s, c, optionId, opt.label);
  s.messages.push({ id: nextId(s, 'm'), key: `reply:${c.id}:${replyId}`, caseId: c.id, from: 'patient', channel: patient.channel, at: s.now, parts: [T(said)] });
  event(s, c, 'patient', 'reply', `Replied: “${said}”`, 'Reply received. Any pending follow-up is replaced by the next step.');
  c.nudgesSent = 0;

  if (c.status === 'no_response' || c.status === 'declined') {
    event(s, c, 'coordinator', 'resume', 'Case reopened by patient reply', 'A reply from the patient always reopens follow-up.');
    c.status = 'awaiting_reply';
    c.closedReason = undefined;
  }

  s.now += MIN;
  const noteRef = note.id;

  const offerTimes = (mode: 'preferred' | 'more', intro: string) => {
    const slots = offer(s, c, 'treatment', mode);
    suppressPending(s, c, 'Patient is choosing a time now.', ['followup', 'resume', 'close_no_response']);
    send(s, c, k('offer'), [T(`${intro} `), F(`Plan for about ${dur(tx.minutes)}`, 'scheduling#lengths'), T(`:\n${slotLines(slots)}`)], 'Times offered');
    event(s, c, 'coordinator', 'schedule', `Offered ${slots.length} times with ${provider.short}`,
      `Checked live availability: ${dur(tx.minutes)} with the treating dentist, at least 24 hours out, ${mode === 'preferred' && patient.timePreference !== 'any' ? `${patient.timePreferenceLabel.toLowerCase()} preferred` : 'any time of day'}.`,
      { faq: ['scheduling#lengths'] });
    c.stage = 'offering';
    c.status = 'awaiting_reply';
    scheduleFollowup(s, c);
  };

  const pause = (until: number, why: string) => {
    suppressPending(s, c, `Patient asked us to check back on ${fmtWDM(until)}. No messages before then.`);
    c.status = 'paused';
    c.stage = 'paused';
    c.pausedUntil = until;
    c.offeredSlotIds = [];
    if (c.barrier === 'unknown') c.barrier = 'scheduling';
    send(s, c, k('pause'), [T(`Of course. I’ll check back on ${fmtWDM(until)}, and you won’t hear from us about this before then. If you’re ready sooner, just reply here.`)], 'Pause confirmed');
    event(s, c, 'coordinator', 'pause', `Paused until ${fmtWDM(until)}`, `${why} Follow-up is suppressed until then; records are rechecked before resuming.`);
    schedule(s, c, 'resume', until, 'Check back');
  };

  const restartTimer = () => {
    suppressPending(s, c, 'Patient is engaged; follow-up timer restarted.', ['followup', 'close_no_response']);
    scheduleFollowup(s, c);
  };

  const dentistHandoff = (entry: FaqEntry, ref: string) => {
    send(s, c, k('handoff'), [
      T(`That’s a good question for ${provider.short} directly. `),
      C(`${provider.short}’s note explains why ${tx.a} was recommended`, noteRef),
      T(', but it doesn’t cover this, and '),
      F('I don’t want to guess about something this specific to you', ref),
      T(`. I can set up a 20-minute call with ${provider.short} and share your question with the team beforehand. Would that help?`),
    ], 'Dentist call offered');
    event(s, c, 'coordinator', 'handoff', `Question not answered by the chart · call with ${provider.short} offered`,
      `“${entry.q}” is a clinical question for this patient. The chart doesn’t cover it, so the coordinator doesn’t speculate.`, { noteIds: [noteRef], faq: [ref] });
    c.stage = 'handoff_offer';
    restartTimer();
  };

  switch (true) {
    case optionId === 'why': {
      c.asked.push('why');
      if (c.barrier === 'unknown') c.barrier = 'understanding';
      const w = faq(s, tx.faq, 'why');
      send(s, c, k('why'), [C(note.patientSummary, noteRef), T(' '), F(w?.a ?? '', `${tx.faq}#why`), T('\n\nWould you like to see some times?')], 'Explanation');
      event(s, c, 'coordinator', 'explanation', 'Recommendation explained',
        `Reason taken only from ${provider.short}’s ${fmtDM(note.date)} note; general background from ${s.faqs[tx.faq].file}.`, { noteIds: [noteRef], faq: [`${tx.faq}#why`] });
      c.stage = 'explained';
      restartTimer();
      break;
    }
    case optionId.startsWith('q:'): {
      const key = optionId.slice(2);
      c.asked.push(optionId);
      if (c.barrier === 'unknown') c.barrier = 'understanding';
      const entry = faq(s, tx.faq, key)!;
      const ref = `${tx.faq}#${key}`;
      if (entry.route === 'dentist' && !note.covers.includes(key)) {
        dentistHandoff(entry, ref);
      } else {
        send(s, c, k(key), [F(entry.a ?? '', ref), T(c.status === 'booked' ? '' : ' Would you like to see some times?')], 'Question answered');
        event(s, c, 'coordinator', 'explanation', `Answered “${entry.q}”`, `From ${s.faqs[tx.faq].file} (general information).`, { faq: [ref] });
        if (c.stage === 'intro') c.stage = 'explained';
        restartTimer();
      }
      break;
    }
    case optionId === 'visit': {
      c.asked.push('visit');
      const v = faq(s, 'the-appointment', 'visit');
      send(s, c, k('visit'), [F(`Plan for about ${dur(tx.minutes)}`, 'scheduling#lengths'), T('. '), F(v?.a ?? '', 'the-appointment#visit'), T(c.status === 'booked' ? '' : ' Would you like to see some times?')], 'Question answered');
      event(s, c, 'coordinator', 'explanation', 'Explained what the visit involves', 'From the-appointment.md and scheduling.md.', { faq: ['the-appointment#visit', 'scheduling#lengths'] });
      if (c.status !== 'booked') {
        if (c.stage === 'intro') c.stage = 'explained';
        restartTimer();
      }
      break;
    }
    case optionId === 'cost': {
      c.asked.push('cost');
      suppressPending(s, c, 'A person is handling a cost question; automated follow-up waits.');
      send(s, c, k('cost'), [T('Good question. '), F('Our front desk can check your insurance and give you an exact amount', 'costs#cost'), T(', so I’ve asked them to call you. You won’t hear from me in the meantime.')], 'Handed to front desk');
      c.hold = { to: 'front_desk', reason: 'Asked what it will cost', since: s.now };
      const h = { id: nextId(s, 'h'), caseId: c.id, at: s.now, to: 'front_desk' as const, routedTo: 'Front desk', question: 'How much will it cost?', status: 'open' as const };
      s.handoffs[h.id] = h;
      c.handoffId = h.id;
      event(s, c, 'coordinator', 'handoff', 'Handed to front desk', 'Cost questions need a person to quote an exact amount. No outreach until someone has called.', { faq: ['costs#cost'] });
      break;
    }
    case optionId === 'consult_yes' || optionId === 'more_consult_times': {
      const more = optionId === 'more_consult_times';
      if (!more && !c.handoffId) {
        const q = c.asked.filter((a) => a.startsWith('q:')).map((a) => faq(s, tx.faq, a.slice(2))?.q).filter(Boolean).join(' / ') || `Questions about ${tx.a}`;
        const h = { id: nextId(s, 'h'), caseId: c.id, at: s.now, to: 'dentist' as const, routedTo: provider.short, question: q, status: 'open' as const };
        s.handoffs[h.id] = h;
        c.handoffId = h.id;
        event(s, c, 'coordinator', 'handoff', `Question sent to ${provider.short}’s team`, 'Patient agreed to a call. The question and the recorded reason were shared so the dentist can answer directly.');
      }
      const slots = offer(s, c, 'consult', more ? 'more' : 'preferred');
      send(s, c, k('consult_offer'), [T(`${more ? 'Here are a few more' : `Great. Here are the next openings for a 20-minute call with ${provider.short}`}:\n${slotLines(slots)}`)], 'Call times offered');
      c.stage = 'consult_offering';
      restartTimer();
      break;
    }
    case optionId.startsWith('consult_slot:'): {
      const sl = getSlot(optionId.split(':')[1])!;
      const appt: Appointment = { id: nextId(s, 'appt'), caseId: c.id, slotId: sl.id, providerId: sl.providerId, type: 'consult', start: sl.start, end: sl.end, status: 'booked', bookedAt: s.now };
      s.appointments[appt.id] = appt;
      s.bookedSlots[sl.id] = appt.id;
      c.consultAppointmentId = appt.id;
      c.offeredSlotIds = [];
      c.status = 'consult_booked';
      c.stage = 'consult_booked';
      if (c.handoffId) s.handoffs[c.handoffId].status = 'discussion_booked';
      suppressPending(s, c, 'Call booked; no scheduling follow-up needed.');
      send(s, c, k('consult_booked'), [T(`Booked: a 20-minute call with ${provider.short} on ${fmtWDM(sl.start)} at ${fmtTime(sl.start)}. I’ve shared your question with the team so they’re ready. Nothing else is booked; you can decide after you’ve talked.`)], 'Call booked');
      event(s, c, 'coordinator', 'booking', `Call with ${provider.short} booked · ${fmtWDM(sl.start)}, ${fmtTime(sl.start)}`, 'Treatment stays unbooked until the patient decides.');
      const callReminder = withTime(addDays(sl.start, -1), 17);
      if (callReminder > s.now) schedule(s, c, 'reminder', callReminder, 'Call reminder');
      else schedule(s, c, 'consult_check', sl.end + 2 * HOUR, 'Check in after the call');
      break;
    }
    case optionId === 'reschedule_consult': {
      const a = activeConsult(s, c);
      if (a) cancelAppointment(s, a, 'Patient asked to change the time');
      event(s, c, 'patient', 'cancellation', 'Patient changed the call time', 'Previous slot released back to the schedule.');
      if (c.handoffId) s.handoffs[c.handoffId].status = 'open';
      c.status = 'awaiting_reply';
      const slots = offer(s, c, 'consult', 'preferred');
      suppressPending(s, c, 'Rescheduling in progress.');
      send(s, c, k('consult_offer'), [T(`No problem, I’ve released that time. Other openings with ${provider.short}:\n${slotLines(slots)}`)], 'Call times offered');
      c.stage = 'consult_offering';
      scheduleFollowup(s, c);
      break;
    }
    case optionId === 'consult_no':
      c.stage = 'explained';
      send(s, c, k('consult_no'), [T('No problem. Whenever you’re ready, I can share appointment times, or check back with you later.')], 'Acknowledged');
      restartTimer();
      break;
    case optionId === 'consult_later':
      pause(nextWeek(s.now), 'Patient wants time to think about a call.');
      break;
    case ['book', 'ready', 'proceed', 'reopen'].includes(optionId): {
      if (c.barrier === 'unknown') c.barrier = 'scheduling';
      if (c.status === 'paused') {
        event(s, c, 'coordinator', 'resume', 'Pause ended early by patient', 'Patient replied before the requested check-back date.');
        c.pausedUntil = undefined;
      }
      const pref = patient.timePreference !== 'any' ? ` (${patient.timePreferenceLabel.toLowerCase()}, as you prefer)` : '';
      offerTimes('preferred', `Here are the next openings with ${provider.short}${pref}.`);
      break;
    }
    case optionId === 'more_times':
      offerTimes('more', `Here are a few more openings with ${provider.short}, any time of day.`);
      break;
    case optionId.startsWith('slot:'): {
      const sl = getSlot(optionId.split(':')[1])!;
      if (s.bookedSlots[sl.id] || activeAppt(s, c)) break; // never double-book
      const end = sl.start + tx.minutes * MIN;
      const appt: Appointment = { id: nextId(s, 'appt'), caseId: c.id, slotId: sl.id, providerId: sl.providerId, type: 'treatment', start: sl.start, end, status: 'booked', bookedAt: s.now };
      s.appointments[appt.id] = appt;
      s.bookedSlots[sl.id] = appt.id;
      c.appointmentId = appt.id;
      c.offeredSlotIds = [];
      c.status = 'booked';
      c.stage = 'booked';
      c.pausedUntil = undefined;
      suppressPending(s, c, 'Appointment exists, so scheduling messages are no longer needed.');
      send(s, c, k('booked'), [T(`You’re booked: ${fmtWDM(sl.start)} at ${fmtTime(sl.start)} with ${provider.short} at ${PRACTICE.name}, ${PRACTICE.address}. I’ll send a reminder the day before. If anything changes, just reply here.`)], 'Booked');
      event(s, c, 'coordinator', 'booking', `Booked · ${fmtWDM(sl.start)}, ${fmtTime(sl.start)}`,
        `Patient chose this time. Checked: treating dentist (${provider.short}), ${dur(tx.minutes)}, at least 24 hours out, slot free. Written to the appointment book.`, { faq: ['scheduling#rules'] });
      const reminderAt = withTime(addDays(sl.start, -1), 17);
      if (reminderAt > s.now) schedule(s, c, 'reminder', reminderAt, 'Reminder');
      else schedule(s, c, 'visit_check', end, 'Check schedule after visit');
      break;
    }
    case optionId === 'reschedule' || optionId === 'cancel_appt': {
      const a = activeAppt(s, c);
      if (a) cancelAppointment(s, a, 'Patient request');
      event(s, c, 'patient', 'cancellation', optionId === 'reschedule' ? 'Patient asked to reschedule' : 'Patient cancelled', 'Slot released back to the appointment book. Follow-up reopened.');
      c.appointmentId = undefined;
      c.next = undefined;
      offerTimes('preferred', `Done, I’ve ${optionId === 'reschedule' ? 'released your previous time' : 'cancelled that appointment'}. Other openings with ${provider.short}.`);
      break;
    }
    case optionId === 'pause_week':
      pause(nextWeek(s.now), 'Patient asked to reconnect next week.');
      break;
    case optionId === 'pause_month':
      pause(nextContactTime(withTime(addDays(s.now, 30), 10)), 'Patient asked to reconnect in a month.');
      break;
    case optionId === 'decline': {
      const consult = activeConsult(s, c);
      if (consult) cancelAppointment(s, consult, 'Patient declined');
      suppressPending(s, c, 'Patient declined. All outreach stops.');
      Object.assign(c, { status: 'declined', stage: 'closed', offeredSlotIds: [], pausedUntil: undefined, hold: undefined, closedReason: 'Patient decided not to go ahead.' });
      send(s, c, k('decline'), [T(`Understood. I’ve noted that you’ve decided not to go ahead with the ${tx.label.toLowerCase()}, and I won’t send more reminders about it. If anything changes, reply here or call us at ${PRACTICE.phone}.`)], 'Decision recorded');
      event(s, c, 'patient', 'closed', 'Patient decided not to go ahead', 'Decision respected and visible to the dentist. No further outreach.');
      break;
    }
    case optionId === 'stop': {
      suppressPending(s, c, 'Patient opted out of messages.');
      send(s, c, k('stop'), [T(patient.channel === 'email' ? 'You’ve been unsubscribed from Harbor Dental follow-up emails.' : 'You’ve been unsubscribed from Harbor Dental follow-up texts. Reply START to opt back in.')], 'Opt-out confirmed');
      Object.assign(c, { status: 'opted_out', stage: 'closed', offeredSlotIds: [], pausedUntil: undefined, closedReason: 'Patient opted out.' });
      event(s, c, 'patient', 'closed', 'Patient stopped messages', `Contact permission ended. All future outreach cancelled.${activeAppt(s, c) ? ' Existing appointment kept; no reminders will be sent.' : ''}`);
      break;
    }
    case optionId === 'start':
      c.status = 'awaiting_reply';
      c.stage = 'intro';
      c.closedReason = undefined;
      send(s, c, k('start'), [T(`You’re opted back in. `), C(`${provider.short} recommended ${tx.a} for your ${rec.area}`, noteRef), T('. Would you like to schedule, or do you have questions first?')], 'Opt-in confirmed');
      event(s, c, 'patient', 'resume', 'Patient opted back in', 'Contact permission restored by the patient.');
      scheduleFollowup(s, c);
      break;
  }
  void first;
}

// ── scheduled wake-ups ───────────────────────────────────────────────────────

function runWake(s: State, c: Case, wake: Wake, replay = false) {
  if (s.processedKeys[wake.key]) {
    event(s, c, 'coordinator', 'duplicate', 'Duplicate event ignored', `“${wake.label}” was already processed on ${fmtDateTime(s.processedKeys[wake.key])}. Nothing was sent or booked.`);
    return;
  }
  s.processedKeys[wake.key] = s.now;
  s.lastWake = { caseId: c.id, wake };
  if (!replay && c.next?.key === wake.key) c.next = undefined;

  const { patient, rec, provider, note, tx, first } = ctx(s, c);
  const k = (n: string) => `msg:${wake.key}:${n}`;
  const optOut = patient.channel === 'email' ? ' You can unsubscribe anytime.' : ' Reply STOP to opt out.';

  switch (wake.type) {
    case 'outreach': {
      if (!canContact(c) || !isOpen(c) || c.hold) return;
      if (activeAppt(s, c)) {
        event(s, c, 'coordinator', 'suppressed', 'First message skipped: already booked', 'An existing booking suppresses scheduling messages.');
        return;
      }
      const days = Math.round((s.now - rec.recommendedOn) / DAY);
      send(s, c, k('outreach'), [
        T(`Hi ${first}, this is ${PRACTICE.name}. `),
        C(`At your ${fmtDM(rec.recommendedOn)} visit, ${provider.short} recommended ${tx.a} for your ${rec.area}`, note.id),
        T(`. We haven’t seen it on the schedule yet. Would you like to book a time, or do you have questions first?${optOut}`),
      ], 'First message');
      event(s, c, 'coordinator', 'outreach', `First ${patient.channel === 'email' ? 'email' : 'text'} sent`,
        `Treatment plan shows ${tx.a} recommended ${days} days ago with nothing booked. Contact preference: ${patient.channel}, ${patient.contactWindow}. No approval step.`);
      c.status = 'awaiting_reply';
      c.stage = 'intro';
      c.nudgesSent = 0;
      scheduleFollowup(s, c);
      return;
    }
    case 'followup': {
      if (c.status !== 'awaiting_reply' || c.hold) {
        event(s, c, 'coordinator', 'suppressed', 'Follow-up skipped', c.hold ? 'A person is handling this patient.' : `Case is ${c.status.replace('_', ' ')}; follow-up not needed.`);
        return;
      }
      if (c.nudgesSent >= MAX_FOLLOWUPS) {
        schedule(s, c, 'close_no_response', s.now, 'Stop outreach');
        return;
      }
      c.nudgesSent += 1;
      const tag = `Follow-up ${c.nudgesSent} of ${MAX_FOLLOWUPS}`;
      if (c.stage === 'offering' || c.stage === 'consult_offering') {
        const slots = offer(s, c, c.stage === 'offering' ? 'treatment' : 'consult', 'preferred');
        send(s, c, k('fu'), [T(`Hi ${first}, just checking in. These times are still open with ${provider.short}:\n${slotLines(slots)}\n\nWant me to hold one?`)], tag);
      } else if (c.stage === 'handoff_offer') {
        send(s, c, k('fu'), [T(`Hi ${first}, just checking in. Would a short call with ${provider.short} about your question help? No pressure either way.`)], tag);
      } else if (c.stage === 'post_consult') {
        send(s, c, k('fu'), [T(`Hi ${first}, checking in after your call with ${provider.short}. Would you like to schedule, or do you need more time? Either is fine.`)], tag);
      } else if (c.nudgesSent === MAX_FOLLOWUPS) {
        const w = faq(s, tx.faq, 'why');
        send(s, c, k('fu'), [T(`Hi ${first}, this is our last reminder about the ${tx.label.toLowerCase()} ${provider.short} recommended. `), F(w?.a ?? '', `${tx.faq}#why`), T(' Reply anytime if you’d like to book.')], tag);
      } else {
        send(s, c, k('fu'), [T(`Hi ${first}, just checking in about the ${tx.label.toLowerCase()} ${provider.short} recommended. I can share a few times, or answer any questions.`)], tag);
      }
      event(s, c, 'coordinator', 'message', `${tag} sent`, `No reply since the last message. Records rechecked: nothing booked, not paused, contact allowed. Capped at the first message plus ${MAX_FOLLOWUPS} follow-ups.`);
      if (c.nudgesSent < MAX_FOLLOWUPS) scheduleFollowup(s, c);
      else schedule(s, c, 'close_no_response', nextContactTime(withTime(s.now + CLOSE_AFTER, 10)), 'Stop outreach if still no reply');
      return;
    }
    case 'close_no_response': {
      if (c.status !== 'awaiting_reply') return;
      Object.assign(c, { status: 'no_response', stage: 'closed', offeredSlotIds: [], closedReason: 'No reply after the first message and 2 follow-ups.' });
      event(s, c, 'coordinator', 'closed', 'Outreach stopped: no reply after 3 messages', 'Cap reached. A reply from the patient reopens the case.');
      return;
    }
    case 'resume': {
      if (c.status !== 'paused') return;
      c.pausedUntil = undefined;
      if (activeAppt(s, c)) {
        c.status = 'booked';
        c.stage = 'booked';
        event(s, c, 'coordinator', 'suppressed', 'Check-back skipped: already booked', 'Appointment found in the appointment book.');
        return;
      }
      c.status = 'awaiting_reply';
      const slots = offer(s, c, 'treatment', 'preferred');
      const prev = s.events.filter((e) => e.caseId === c.id && e.kind === 'pause').pop();
      send(s, c, k('resume'), [T(`Hi ${first}, checking back as you asked. ${provider.short} has these openings. `), F(`Plan for about ${dur(tx.minutes)}`, 'scheduling#lengths'), T(`:\n${slotLines(slots)}\n\nWant one of these, or do you need longer?`)], 'Check-back');
      event(s, c, 'coordinator', 'resume', 'Resumed after the requested pause',
        `Remembered the pause${prev ? ` from ${fmtWDM(prev.at)}` : ''}. Rechecked first: nothing booked, treatment not complete, contact allowed. Fresh times offered.`);
      c.stage = 'offering';
      scheduleFollowup(s, c);
      return;
    }
    case 'reminder': {
      const call = activeAppt(s, c) ? undefined : activeConsult(s, c);
      const a = activeAppt(s, c) ?? call;
      if (!a) return;
      const what = call ? `call with ${provider.short} is tomorrow, ${fmtWDM(a.start)} at ${fmtTime(a.start)} (20 minutes)` : `appointment with ${provider.short} is tomorrow, ${fmtWDM(a.start)} at ${fmtTime(a.start)} (about ${dur(tx.minutes)})`;
      send(s, c, k('reminder'), [T(`Reminder: your ${what}. Reply here if you need a different time.`)], 'Reminder');
      if (canContact(c)) event(s, c, 'coordinator', 'message', 'Reminder sent', 'Confirmed in the appointment book the day before.');
      if (call) schedule(s, c, 'consult_check', a.end + 2 * HOUR, 'Check in after the call');
      else schedule(s, c, 'visit_check', a.end, 'Check schedule after visit');
      return;
    }
    case 'visit_check': {
      const a = activeAppt(s, c);
      if (!a) return;
      a.status = 'time_passed';
      c.status = 'visit_passed';
      event(s, c, 'practice', 'record', 'Visit time passed · waiting for completion record',
        'Attending isn’t the same as finishing treatment. The case stays open until treatment history shows it complete.');
      schedule(s, c, 'completion_check', withTime(addDays(s.now, 14), 9), 'Recheck treatment history');
      return;
    }
    case 'completion_check': {
      if (c.status !== 'visit_passed') return;
      event(s, c, 'coordinator', 'record', 'No completion record yet · still tracking', 'Visible to staff in the list; no patient message sent.');
      return;
    }
    case 'consult_check': {
      const a = activeConsult(s, c);
      if (!a) return;
      a.status = 'time_passed';
      const tpl = CONSULT_NOTES[c.patientId] ?? CONSULT_NOTES.default;
      const consultNote = { ...tpl, id: tpl.id === 'note-consult' ? `note-consult-${c.id}` : tpl.id, patientId: c.patientId, providerId: c.providerId, date: a.start };
      s.notes[consultNote.id] = consultNote;
      if (c.handoffId) s.handoffs[c.handoffId].status = 'discussed';
      event(s, c, 'practice', 'record', `${provider.short} added a note from the call`, 'Patient chart updated after the call.', { noteIds: [consultNote.id] });
      c.status = 'awaiting_reply';
      c.stage = 'post_consult';
      send(s, c, k('post'), [T(`Hi ${first}, thanks for talking with ${provider.short}. `), C(consultNote.patientSummary, consultNote.id), T('\n\nIt’s your decision. Would you like to schedule, take more time, or not go ahead?')], 'Decision check-in');
      event(s, c, 'coordinator', 'message', 'Checked in after the call', 'Summarised only what the dentist recorded. The patient decides.', { noteIds: [consultNote.id] });
      scheduleFollowup(s, c);
      return;
    }
  }
}

/** Process every due wake-up, in time order, up to `until`. */
export function tick(s: State, until: number) {
  for (let guard = 0; guard < 1000; guard++) {
    let best: Case | undefined;
    for (const id of s.caseOrder) {
      const c = s.cases[id];
      if (c.next && c.next.at <= until && (!best || c.next.at < best.next!.at)) best = c;
    }
    if (!best) break;
    s.now = Math.max(s.now, best.next!.at);
    runWake(s, best, best.next!);
  }
  s.now = Math.max(s.now, until);
  s.lastSync = Math.max(s.lastSync, Math.floor((s.now - 4 * MIN) / (15 * MIN)) * 15 * MIN + 4 * MIN); // every 15 minutes, at :04/:19/:34/:49
}

// ── practice and staff events ────────────────────────────────────────────────

function practiceCancel(s: State, c: Case) {
  const a = activeAppt(s, c) ?? activeConsult(s, c);
  if (!a) return;
  const { first, provider, tx } = ctx(s, c);
  const isCall = a.type === 'consult';
  cancelAppointment(s, a, `${provider.short} unavailable`);
  s.blockedDays[dayKey(a.providerId, a.start)] = `${provider.short} unavailable`;
  event(s, c, 'practice', 'cancellation', `Appointment book: ${isCall ? 'call' : 'appointment'} on ${fmtWDM(a.start)} cancelled`,
    `${provider.short} is no longer available that day. That day is removed from offered times.`);
  suppressPending(s, c, 'The appointment it depended on was cancelled.');
  if (isCall) c.consultAppointmentId = undefined;
  else c.appointmentId = undefined;
  if (c.status === 'opted_out' || c.status === 'paused') {
    event(s, c, 'coordinator', 'suppressed', 'Not contacting patient about the cancellation', c.status === 'opted_out' ? 'Patient opted out.' : 'Patient asked us to pause; new times come when the pause ends.');
    return;
  }
  c.status = 'awaiting_reply';
  const slots = offer(s, c, isCall ? 'consult' : 'treatment', 'preferred');
  s.now += 5 * MIN;
  send(s, c, `msg:${a.id}:practice-cancel`, [T(`Hi ${first}, I’m sorry, ${provider.short} is no longer available on ${fmtWDM(a.start)}, so we’ve had to cancel your ${isCall ? 'call' : tx.label.toLowerCase() + ' appointment'}. Here are the next openings:\n${slotLines(slots)}\n\nWant one of these, or should I check back later?`)], 'Cancellation recovery');
  event(s, c, 'coordinator', 'resume', 'Reopened after cancellation', 'A cancellation reopens follow-up unless the patient paused or stopped messages.');
  c.stage = isCall ? 'consult_offering' : 'offering';
  if (isCall && c.handoffId) s.handoffs[c.handoffId].status = 'open';
  scheduleFollowup(s, c);
}

function recordCompletion(s: State, c: Case) {
  if (c.status === 'completed') return;
  const { first, tx } = ctx(s, c);
  const a = c.appointmentId ? s.appointments[c.appointmentId] : undefined;
  if (a && a.status !== 'cancelled') a.status = 'completed';
  suppressPending(s, c, 'Treatment complete. Nothing left to follow up on.');
  c.next = undefined;
  event(s, c, 'practice', 'completion', 'Treatment history: completed', 'Confirmed by the practice record, not inferred from attendance. Follow-up closed.');
  if (c.status !== 'opted_out') {
    s.now += 5 * MIN;
    send(s, c, `msg:${c.id}:completed`, [T(`Hi ${first}, our records show your ${tx.label.toLowerCase()} is complete. That’s the last message you’ll get from us about it. Thanks for taking care of it!`)], 'Completion notice');
  }
  Object.assign(c, { status: 'completed', stage: 'closed', offeredSlotIds: [], pausedUntil: undefined, hold: undefined, closedReason: 'Treatment history shows it complete.' });
}

function resolveHold(s: State, c: Case) {
  if (!c.hold) return;
  c.hold = undefined;
  if (c.handoffId && s.handoffs[c.handoffId].to === 'front_desk') s.handoffs[c.handoffId].status = 'resolved';
  event(s, c, 'staff', 'resume', 'Front desk called the patient', 'Marked as called by staff. Automated follow-up resumes.');
  scheduleFollowup(s, c);
}

function staffPause(s: State, c: Case) {
  if (!isOpen(c) || c.status === 'paused') return;
  const until = nextWeek(s.now);
  suppressPending(s, c, 'Paused by staff.');
  c.status = 'paused';
  c.stage = 'paused';
  c.pausedUntil = until;
  event(s, c, 'staff', 'pause', `Paused by staff until ${fmtWDM(until)}`, 'No messages go out until then.');
  schedule(s, c, 'resume', until, 'Check back');
}

// ── public API ───────────────────────────────────────────────────────────────

/** Apply an action to a draft state in place. */
export function apply(s: State, action: Action) {
  switch (action.type) {
    case 'reply':
      handleReply(s, action.caseId, action.optionId);
      break;
    case 'advance':
      tick(s, s.now + action.ms);
      break;
    case 'advanceTo':
      tick(s, action.at);
      break;
    case 'jumpNext': {
      const target = nextWakeAt(s, action.caseId);
      if (target !== undefined) tick(s, Math.max(target, s.now));
      break;
    }
    case 'practiceCancel':
      if (s.cases[action.caseId]) practiceCancel(s, s.cases[action.caseId]);
      break;
    case 'recordCompletion':
      if (s.cases[action.caseId]) recordCompletion(s, s.cases[action.caseId]);
      break;
    case 'sendNow': {
      // Only the draft the user saw: a double-tap can't send the step after it.
      const c = s.cases[action.caseId];
      if (c?.next && c.next.key === action.key) runWake(s, c, c.next);
      break;
    }
    case 'staffPause':
      if (s.cases[action.caseId]) staffPause(s, s.cases[action.caseId]);
      break;
    case 'resolveHold':
      if (s.cases[action.caseId]) resolveHold(s, s.cases[action.caseId]);
      break;
    case 'sync':
      s.lastSync = s.now;
      break;
    case 'editFaq': {
      const f = s.faqs[action.fileId];
      if (f) Object.assign(f, fromMarkdown(action.md, f), { edited: s.now, editedBy: 'You' });
      break;
    }
    case 'replayLast':
      if (s.lastWake) runWake(s, s.cases[s.lastWake.caseId], s.lastWake.wake, true);
      break;
  }
}

export function dispatch(prev: State, action: Action): State {
  const s: State = structuredClone(prev);
  apply(s, action);
  return s;
}

/** Dry run: what would the pending wake-up do? Returns the message it would send, if any. */
export function previewNext(s: State, caseId: string): { at: number; label: string; message?: Message; note?: string } | null {
  const c = s.cases[caseId];
  if (!c?.next) return null;
  // This message quotes the dentist's note from the call, which doesn't exist until the call happens.
  if (c.next.type === 'consult_check') return { at: c.next.at, label: c.next.label, note: `Wording comes from ${s.providers[c.providerId].short}’s note after the call.` };
  const draft: State = structuredClone(s);
  const dc = draft.cases[caseId];
  draft.now = Math.max(draft.now, dc.next!.at);
  const before = draft.messages.length;
  runWake(draft, dc, dc.next!);
  const message = draft.messages.slice(before).find((m) => m.caseId === caseId && m.from === 'coordinator');
  return { at: c.next.at, label: c.next.label, message };
}

export function nextWakeAt(s: State, caseId?: string): number | undefined {
  if (caseId) return s.cases[caseId]?.next?.at;
  let min: number | undefined;
  for (const id of s.caseOrder) {
    const t = s.cases[id].next?.at;
    if (t !== undefined && (min === undefined || t < min)) min = t;
  }
  return min;
}

export function canPracticeCancel(s: State, caseId: string) {
  const c = s.cases[caseId];
  return !!c && !!(activeAppt(s, c) ?? activeConsult(s, c));
}

export function canRecordCompletion(s: State, caseId: string) {
  const c = s.cases[caseId];
  return !!c && c.status !== 'completed';
}

export function currentAppointment(s: State, c: Case): Appointment | undefined {
  const ids = [c.appointmentId, c.consultAppointmentId].filter(Boolean) as string[];
  return ids.map((id) => s.appointments[id]).find((a) => a && a.status !== 'cancelled');
}

/** Dry run: the reply a patient would get to a question, composed by the real engine. */
export function previewAnswer(s: State, caseId: string, optionId: string): Message | undefined {
  const draft: State = structuredClone(s);
  const c = draft.cases[caseId];
  Object.assign(c, { asked: [], stage: 'intro', status: 'awaiting_reply', hold: undefined, appointmentId: undefined, consultAppointmentId: undefined, handoffId: undefined });
  const before = draft.messages.length;
  apply(draft, { type: 'reply', caseId, optionId });
  return draft.messages.slice(before).find((m) => m.from === 'coordinator');
}
