import type {
  Appointment, Case, CaseEvent, CaseStatus, Message, MessageSection, ReplyOption, Slot, State, Wake, WakeType,
} from './types';
import { CONSULT_NOTES, PRACTICE } from './seed';
import { dayKey, findSlots, getSlot, isBookable } from './slots';
import { DAY, HOUR, MIN, addDays, fmtDate, fmtDateTime, fmtTime, nextContactTime, nextWeek, withTime } from './time';

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
  | { type: 'jumpNext'; caseId?: string }
  | { type: 'practiceCancel'; caseId: string }
  | { type: 'recordCompletion'; caseId: string }
  | { type: 'replayLast' };

// ── small helpers ────────────────────────────────────────────────────────────

const ctx = (s: State, c: Case) => {
  const patient = s.patients[c.patientId];
  const rec = s.recommendations[c.recommendationId];
  const provider = s.providers[c.providerId];
  const note = s.notes[rec.noteId];
  return { patient, rec, provider, note };
};

function nextId(s: State, prefix: string) {
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}

function event(
  s: State, c: Case, actor: CaseEvent['actor'], kind: CaseEvent['kind'], title: string, why: string,
  refs?: CaseEvent['refs'],
) {
  s.events.push({ id: nextId(s, 'e'), caseId: c.id, at: s.now, actor, kind, title, why, refs });
}

/** Send a coordinator message exactly once per key. Returns false if the key was already used. */
function send(s: State, c: Case, key: string, text: string, extra: Partial<Message> = {}): boolean {
  if (s.processedKeys[key]) return false;
  if (!canContact(c)) return false;
  s.processedKeys[key] = s.now;
  s.messages.push({ id: nextId(s, 'm'), key, caseId: c.id, from: 'coordinator', at: s.now, text, ...extra });
  if (extra.tag) c.lastAction = { label: extra.tag, at: s.now };
  if (extra.sources) {
    for (const k of extra.sources.kbIds) if (!c.kbRefs.includes(k)) c.kbRefs.push(k);
    for (const n of extra.sources.noteIds) if (!c.noteRefs.includes(n)) c.noteRefs.push(n);
  }
  return true;
}

function schedule(s: State, c: Case, type: WakeType, atTime: number, label: string) {
  c.next = { type, at: atTime, key: `wake:${type}:${c.id}:${nextId(s, 'w')}`, label };
}

/** Cancel a pending wake-up, logging why it was suppressed (pause, booking, completion…). */
function suppressPending(s: State, c: Case, reason: string, onlyTypes?: WakeType[]) {
  const n = c.next;
  if (!n) return;
  if (onlyTypes && !onlyTypes.includes(n.type)) return;
  c.next = undefined;
  if (n.type === 'outreach' || n.type === 'followup' || n.type === 'close_no_response' || n.type === 'resume') {
    event(s, c, 'coordinator', 'suppressed', `Planned “${n.label.toLowerCase()}” for ${fmtDate(n.at)} cancelled`, reason);
  }
}

function scheduleFollowup(s: State, c: Case) {
  const gap = FOLLOWUP_GAPS[Math.min(c.nudgesSent, FOLLOWUP_GAPS.length - 1)];
  schedule(s, c, 'followup', nextContactTime(withTime(s.now + gap, 10)), `Send follow-up ${c.nudgesSent + 1} of ${MAX_FOLLOWUPS} if no reply`);
}

function activeAppt(s: State, c: Case): Appointment | undefined {
  const a = c.appointmentId ? s.appointments[c.appointmentId] : undefined;
  return a && a.status === 'booked' ? a : undefined;
}

function activeConsult(s: State, c: Case): Appointment | undefined {
  const a = c.consultAppointmentId ? s.appointments[c.consultAppointmentId] : undefined;
  return a && a.status === 'booked' ? a : undefined;
}

function slotLines(slots: Slot[]) {
  return slots.map((sl) => `• ${fmtDate(sl.start)} at ${fmtTime(sl.start)}`).join('\n');
}

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

// ── reply options: generated from the case state, never from a fixed script ─

const MORE_OPTIONS: Record<string, ReplyOption> = {
  pause_week: { id: 'pause_week', label: 'Check back next week', group: 'more' },
  pause_month: { id: 'pause_month', label: 'Check back in a month', group: 'more' },
  decline: { id: 'decline', label: 'I’ve decided not to go ahead', group: 'more' },
  stop: { id: 'stop', label: 'Stop messages', group: 'more', hint: 'Same as replying STOP' },
};

export function replyOptions(s: State, caseId: string): ReplyOption[] {
  const c = s.cases[caseId];
  if (!c) return [];
  const p = (id: string, label: string): ReplyOption => ({ id, label, group: 'primary' });
  const more = (...ids: string[]) => ids.map((id) => MORE_OPTIONS[id]);
  const askable = (id: string, label: string) => (c.asked.includes(id) ? [] : [p(id, label)]);
  const slotOpts = (prefix: string) =>
    c.offeredSlotIds
      .map(getSlot)
      .filter((sl): sl is Slot => !!sl && isBookable(s, sl))
      .map<ReplyOption>((sl) => ({ id: `${prefix}${sl.id}`, label: `${fmtDate(sl.start)} · ${fmtTime(sl.start)}`, group: 'slot' }));

  switch (c.status) {
    case 'opted_out':
      return [p('start', 'START')];
    case 'completed':
      return [];
    case 'visit_passed':
      return more('stop');
    case 'declined':
      return [p('reopen', 'Actually, I’d like to schedule'), ...more('stop')];
    case 'paused':
      return [p('ready', 'I’m ready to schedule now'), ...more('decline', 'stop')];
    case 'booked':
      return [
        ...askable('visit', 'What happens at the appointment?'),
        p('reschedule', 'I need to reschedule'),
        p('cancel_appt', 'Cancel my appointment'),
        ...more('stop'),
      ];
    case 'consult_booked':
      return [p('reschedule_consult', 'I need to change the discussion time'), ...more('decline', 'stop')];
  }

  // awaiting_reply or no_response: depends on where the conversation is.
  switch (c.stage) {
    case 'offering': {
      const slots = slotOpts('slot:');
      return [
        ...slots,
        ...(slots.length ? [p('more_times', 'Other times')] : [p('book', 'Show available times')]),
        p('pause_week', 'Check back next week'),
        ...more('pause_month', 'decline', 'stop'),
      ];
    }
    case 'consult_offering': {
      const slots = slotOpts('consult_slot:');
      return [
        ...slots,
        ...(slots.length ? [p('more_consult_times', 'Other times')] : [p('consult_yes', 'Show discussion times')]),
        ...more('pause_week', 'decline', 'stop'),
      ];
    }
    case 'handoff_offer':
      return [
        p('consult_yes', 'Yes, set up a discussion'),
        p('consult_later', 'Let me think about it'),
        p('consult_no', 'No thanks'),
        ...more('decline', 'stop'),
      ];
    case 'post_consult':
      return [
        p('proceed', 'I’d like to schedule the crown'),
        p('pause_week', 'I need more time'),
        p('decline', 'I’ve decided not to go ahead'),
        ...more('stop'),
      ];
    case 'explained':
      return [
        p('book', 'Yes, let’s find a time'),
        ...askable('visit', 'What happens at the appointment?'),
        ...askable('alt', 'Could a filling work instead?'),
        ...askable('wait', 'What if I wait a few months?'),
        ...more('pause_week', 'pause_month', 'decline', 'stop'),
      ];
    default:
      return [
        ...askable('why', 'Why do I need a crown?'),
        p('book', 'I’m ready to schedule'),
        ...askable('visit', 'What happens at the appointment?'),
        ...more('pause_week', 'pause_month', 'decline', 'stop'),
      ];
  }
}

const PATIENT_TEXT: Record<string, string> = {
  why: 'Why do I need a crown?',
  book: 'Yes, let’s find a time',
  ready: 'I’m ready to schedule now',
  proceed: 'I’d like to schedule the crown',
  reopen: 'Actually, I’d like to schedule',
  visit: 'What happens at the appointment?',
  alt: 'Could a filling work instead?',
  wait: 'What happens if I wait a few months?',
  more_times: 'Do you have other times?',
  more_consult_times: 'Do you have other times?',
  pause_week: 'Can you check back next week?',
  pause_month: 'Can you check back in a month?',
  consult_later: 'Let me think about it',
  consult_yes: 'Yes, please set up a discussion',
  consult_no: 'No thanks',
  decline: 'I’ve decided not to go ahead',
  stop: 'STOP',
  start: 'START',
  reschedule: 'I need to reschedule',
  cancel_appt: 'Please cancel my appointment',
  reschedule_consult: 'I need to change the discussion time',
};

// ── patient replies ──────────────────────────────────────────────────────────

function handleReply(s: State, caseId: string, optionId: string) {
  const c = s.cases[caseId];
  if (!c) return;
  const opt = replyOptions(s, caseId).find((o) => o.id === optionId);
  if (!opt) return; // stale or duplicate tap: ignore, nothing is created

  const { patient, rec, provider, note } = ctx(s, c);
  const replyId = nextId(s, 'r');
  const k = (n: string) => `msg:${c.id}:${replyId}:${n}`;
  s.now += MIN; // the patient replies a moment later on the simulated clock

  let patientText = PATIENT_TEXT[optionId] ?? opt.label;
  if (optionId.startsWith('slot:') || optionId.startsWith('consult_slot:')) {
    const sl = getSlot(optionId.split(':')[1])!;
    patientText = `${fmtDate(sl.start)} at ${fmtTime(sl.start)} works`;
  }
  s.messages.push({ id: nextId(s, 'm'), key: `reply:${c.id}:${replyId}`, caseId: c.id, from: 'patient', at: s.now, text: patientText });
  event(s, c, 'patient', 'reply', `Patient replied: “${patientText}”`, 'Reply received. Pending follow-ups are replaced by the next step.');
  c.nudgesSent = 0;

  if (c.status === 'no_response' || c.status === 'declined') {
    event(s, c, 'coordinator', 'resume', 'Case reopened by patient reply', 'A reply from the patient always reopens coordination.');
    c.status = 'awaiting_reply';
    c.closedReason = undefined;
  }

  s.now += MIN;
  const offerTimes = (mode: 'preferred' | 'more', intro: string) => {
    const slots = offer(s, c, 'crown_prep', mode);
    suppressPending(s, c, 'Patient is choosing a time now.', ['followup', 'resume', 'close_no_response']);
    send(s, c, k('offer'), `${intro}\n\n${slotLines(slots)}\n\nTap a time to book it, or ask for other options.`, {
      tag: 'Appointment times offered', slotIds: slots.map((x) => x.id), sources: { kbIds: ['kb-sched'], noteIds: [] },
    });
    event(s, c, 'coordinator', 'schedule', `Offered ${slots.length} appointment times`,
      `Checked live availability for ${provider.short}: 90-minute crown block, at least 24h out, ${mode === 'preferred' && patient.timePreference !== 'any' ? `${patient.timePreferenceLabel.toLowerCase()} preferred` : 'any time of day'}.`,
      { kbIds: ['kb-sched'] });
    c.stage = 'offering';
    c.status = 'awaiting_reply';
    scheduleFollowup(s, c);
  };

  const pause = (until: number, label: string) => {
    suppressPending(s, c, `Patient asked us to check back on ${fmtDate(until)}. No messages before then.`);
    c.status = 'paused';
    c.stage = 'paused';
    c.pausedUntil = until;
    c.offeredSlotIds = [];
    if (c.barrier === 'unknown') c.barrier = 'scheduling';
    send(s, c, k('pause'), `Of course. I’ll check back on ${fmtDate(until)}, and you won’t hear from us about this before then. If you’re ready sooner, just reply here.`, { tag: 'Pause confirmed' });
    event(s, c, 'coordinator', 'pause', `Paused until ${fmtDate(until)}`, `${label} Follow-up is suppressed until then; records are rechecked before resuming.`);
    schedule(s, c, 'resume', until, 'Check back (patient request)');
  };

  switch (true) {
    case optionId === 'why': {
      c.asked.push('why');
      if (c.barrier === 'unknown') c.barrier = 'understanding';
      const sections: MessageSection[] = [
        { kind: 'clinician', label: `From ${provider.short}’s note · ${fmtDate(note.date)}`, text: note.patientSummary, refId: note.id },
        { kind: 'general', label: 'General information · practice guide', text: s.kb['kb-crown'].patientText, refId: 'kb-crown' },
      ];
      send(s, c, k('why'), 'Would you like to see some appointment times, or do you have another question?', {
        lead: 'Good question. Here\u2019s what your record says, plus some general background:',
        sections, tag: 'Explanation', sources: { kbIds: ['kb-crown'], noteIds: [note.id] },
      });
      event(s, c, 'coordinator', 'explanation', 'Recommendation explained from the record',
        `Patient asked why. Patient-specific reason taken only from ${provider.short}’s ${fmtDate(note.date)} note; general background from the practice guide. Barrier recorded as treatment understanding.`,
        { kbIds: ['kb-crown'], noteIds: [note.id] });
      c.stage = 'explained';
      suppressPending(s, c, 'Patient is engaged; follow-up timer restarted.', ['followup', 'close_no_response']);
      scheduleFollowup(s, c);
      break;
    }
    case optionId === 'visit': {
      c.asked.push('visit');
      const booked = c.status === 'booked';
      send(s, c, k('visit'), booked ? 'Anything else, just reply here.' : 'Would you like to see some appointment times?', {
        sections: [{ kind: 'general', label: 'General information · practice guide', text: s.kb['kb-visit'].patientText, refId: 'kb-visit' }],
        tag: 'Visit information', sources: { kbIds: ['kb-visit'], noteIds: [] },
      });
      event(s, c, 'coordinator', 'explanation', 'Explained what the appointment involves', 'Answered from the practice guide (general information, not patient-specific).', { kbIds: ['kb-visit'] });
      if (!booked) {
        c.stage = 'explained';
        suppressPending(s, c, 'Patient is engaged; follow-up timer restarted.', ['followup', 'close_no_response']);
        scheduleFollowup(s, c);
      }
      break;
    }
    case optionId === 'alt' || optionId === 'wait': {
      c.asked.push(optionId);
      if (c.barrier === 'unknown') c.barrier = 'understanding';
      const covered = note.covers.includes(optionId);
      const gap = optionId === 'alt'
        ? `${provider.short}’s note explains why a crown was recommended, but it doesn’t discuss other options for your tooth.`
        : `Your record doesn’t say how soon this needs to be done, and timing depends on details of your tooth I can’t see.`;
      if (!covered) {
        send(s, c, k('handoff'), `That’s a good question for ${provider.short} directly. I can set up a 20-minute discussion (in the office or by phone), and I’ll share your question with the dental team beforehand so they’re ready. Your crown won’t be scheduled unless you decide to go ahead. Would that help?`, {
          sections: [{ kind: 'notice', label: 'Not in your record', text: `${gap} I don’t want to guess about something this specific to you.` }],
          tag: 'Dentist discussion offered', sources: { kbIds: ['kb-sched'], noteIds: [note.id] },
        });
        event(s, c, 'coordinator', 'handoff', 'Question not answered by the record · dentist discussion offered',
          `“${PATIENT_TEXT[optionId]}” is an individual clinical question. The clinician note does not cover it, so the coordinator does not speculate. Offered a discussion with ${provider.short} (no staff approval needed).`,
          { noteIds: [note.id], kbIds: ['kb-sched'] });
        c.stage = 'handoff_offer';
        suppressPending(s, c, 'Patient is engaged; follow-up timer restarted.', ['followup', 'close_no_response']);
        scheduleFollowup(s, c);
      }
      break;
    }
    case optionId === 'consult_yes' || optionId === 'more_consult_times': {
      const more = optionId === 'more_consult_times';
      if (!more && !c.handoffId) {
        const question = c.asked.filter((a) => a === 'alt' || a === 'wait').map((a) => PATIENT_TEXT[a]).join(' / ') || 'Questions about the recommended crown';
        const h = {
          id: nextId(s, 'h'), caseId: c.id, at: s.now, routedTo: `${provider.short}’s team`, question, status: 'shared' as const,
          context: [
            `${rec.treatment} recommended on ${rec.tooth} (${fmtDate(rec.recommendedOn)})`,
            `Recorded reason: ${note.text}`,
            `Already explained to patient: recorded reason + general crown information`,
            `Contact: ${patient.channel.toLowerCase()} · appointment times: ${patient.timePreferenceLabel.toLowerCase()}`,
            'Patient has not decided on treatment; nothing has been booked for the crown',
          ],
        };
        s.handoffs[h.id] = h;
        c.handoffId = h.id;
        event(s, c, 'coordinator', 'handoff', `Question routed to ${provider.short}’s team with context`,
          'Patient agreed to a discussion. The question, the recorded reason, and what was already explained were shared automatically so the dentist can answer directly.');
      }
      const slots = offer(s, c, 'consult', more ? 'more' : 'preferred');
      send(s, c, k('consult_offer'), `${more ? 'Here are a few more' : `Great. Here are the next openings for a 20-minute discussion with ${provider.short}`}:\n\n${slotLines(slots)}`, {
        tag: 'Discussion times offered', slotIds: slots.map((x) => x.id), sources: { kbIds: ['kb-sched'], noteIds: [] },
      });
      c.stage = 'consult_offering';
      suppressPending(s, c, 'Patient is choosing a time now.', ['followup', 'close_no_response']);
      scheduleFollowup(s, c);
      break;
    }
    case optionId.startsWith('consult_slot:'): {
      const sl = getSlot(optionId.split(':')[1])!;
      const appt: Appointment = {
        id: nextId(s, 'appt'), caseId: c.id, slotId: sl.id, providerId: sl.providerId, type: 'consult',
        start: sl.start, end: sl.end, status: 'booked', bookedAt: s.now,
      };
      s.appointments[appt.id] = appt;
      s.bookedSlots[sl.id] = appt.id;
      c.consultAppointmentId = appt.id;
      c.offeredSlotIds = [];
      c.status = 'consult_booked';
      c.stage = 'consult_booked';
      const h = c.handoffId ? s.handoffs[c.handoffId] : undefined;
      if (h) h.status = 'discussion_booked';
      suppressPending(s, c, 'Discussion booked; no scheduling follow-up needed.');
      send(s, c, k('consult_booked'), `Booked: a 20-minute discussion with ${provider.short} on ${fmtDate(sl.start)} at ${fmtTime(sl.start)}. I’ve shared your question with the dental team so they’re ready.\n\nYour crown isn’t scheduled. You can decide after you’ve talked.`, { tag: 'Discussion booked' });
      event(s, c, 'coordinator', 'booking', `Dentist discussion booked · ${fmtDateTime(sl.start)}`,
        `20-minute discussion with the treating dentist, per scheduling policy. Treatment remains not scheduled until the patient decides.`, { kbIds: ['kb-sched'] });
      schedule(s, c, 'consult_check', sl.end + 2 * HOUR, 'Check in after dentist discussion');
      break;
    }
    case optionId === 'reschedule_consult': {
      const a = activeConsult(s, c);
      if (a) cancelAppointment(s, a, 'Patient asked to change the time');
      event(s, c, 'patient', 'cancellation', 'Patient changed the discussion time', 'Previous discussion slot released back to the schedule.');
      if (c.handoffId) s.handoffs[c.handoffId].status = 'shared';
      c.status = 'awaiting_reply';
      const slots = offer(s, c, 'consult', 'preferred');
      suppressPending(s, c, 'Rescheduling in progress.');
      send(s, c, k('consult_offer'), `No problem, I’ve released that time. Here are other openings with ${provider.short}:\n\n${slotLines(slots)}`, {
        tag: 'Discussion times offered', slotIds: slots.map((x) => x.id),
      });
      c.stage = 'consult_offering';
      scheduleFollowup(s, c);
      break;
    }
    case optionId === 'consult_no': {
      c.stage = 'explained';
      send(s, c, k('consult_no'), 'No problem. Whenever you’re ready, I can share appointment times for the crown, or check back with you later.', { tag: 'Acknowledged' });
      suppressPending(s, c, 'Patient is engaged; follow-up timer restarted.', ['followup', 'close_no_response']);
      scheduleFollowup(s, c);
      break;
    }
    case optionId === 'consult_later':
      pause(nextWeek(s.now), 'Patient wants time to think about a discussion.');
      break;
    case optionId === 'book' || optionId === 'ready' || optionId === 'proceed' || optionId === 'reopen': {
      if (c.barrier === 'unknown') c.barrier = 'scheduling';
      if (optionId === 'proceed' || optionId === 'reopen') {
        event(s, c, 'patient', 'reply', 'Patient chose to proceed with treatment', 'Explicit patient decision recorded.');
      }
      if (c.status === 'paused') {
        event(s, c, 'coordinator', 'resume', 'Pause ended early by patient', 'Patient replied before the requested check-back date.');
        c.pausedUntil = undefined;
      }
      const prefNote = patient.timePreference !== 'any' ? ` (${patient.timePreferenceLabel.toLowerCase()}, as you prefer)` : '';
      offerTimes('preferred', `Here are the next openings with ${provider.short} for your crown visit${prefNote}. Plan for about 90 minutes:`);
      break;
    }
    case optionId === 'more_times':
      offerTimes('more', `Here are a few more openings with ${provider.short}, any time of day:`);
      break;
    case optionId.startsWith('slot:'): {
      const sl = getSlot(optionId.split(':')[1])!;
      if (s.bookedSlots[sl.id] || activeAppt(s, c)) break; // never double-book
      const appt: Appointment = {
        id: nextId(s, 'appt'), caseId: c.id, slotId: sl.id, providerId: sl.providerId, type: 'crown_prep',
        start: sl.start, end: sl.end, status: 'booked', bookedAt: s.now,
      };
      s.appointments[appt.id] = appt;
      s.bookedSlots[sl.id] = appt.id;
      c.appointmentId = appt.id;
      c.offeredSlotIds = [];
      c.status = 'booked';
      c.stage = 'booked';
      c.pausedUntil = undefined;
      suppressPending(s, c, 'Appointment exists, so scheduling messages are no longer needed.');
      send(s, c, k('booked'), `You’re booked: ${fmtDate(sl.start)} at ${fmtTime(sl.start)} with ${provider.short} at ${PRACTICE.name}, ${PRACTICE.address}. I’ll send a reminder the day before. If anything changes, just reply here.`, {
        sections: [{ kind: 'general', label: 'Good to know · scheduling policy', text: s.kb['kb-sched'].patientText, refId: 'kb-sched' }],
        sectionsAfter: true, tag: 'Booking confirmed', sources: { kbIds: ['kb-sched'], noteIds: [] },
      });
      event(s, c, 'coordinator', 'booking', `Crown appointment booked · ${fmtDateTime(sl.start)}`,
        `Patient chose this time. Verified against requirements: treating dentist (${provider.short}), 90-minute crown block, at least 24h out, slot free in the practice schedule. Written to the schedule (simulated).`,
        { kbIds: ['kb-sched'] });
      const reminderAt = withTime(addDays(sl.start, -1), 17);
      if (reminderAt > s.now) schedule(s, c, 'reminder', reminderAt, 'Send appointment reminder');
      else schedule(s, c, 'visit_check', sl.end, 'Check schedule after visit');
      break;
    }
    case optionId === 'reschedule' || optionId === 'cancel_appt': {
      const a = activeAppt(s, c);
      if (a) cancelAppointment(s, a, 'Patient request');
      event(s, c, 'patient', 'cancellation', optionId === 'reschedule' ? 'Patient asked to reschedule' : 'Patient cancelled the appointment',
        'Slot released back to the practice schedule. Coordination reopened.');
      c.appointmentId = undefined;
      c.next = undefined;
      offerTimes('preferred', `Done, I’ve ${optionId === 'reschedule' ? 'released your previous time' : 'cancelled that appointment'}. Here are other openings with ${provider.short}:`);
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
      if (consult) cancelAppointment(s, consult, 'Patient declined treatment');
      suppressPending(s, c, 'Patient declined. All outreach stops.');
      c.status = 'declined';
      c.stage = 'closed';
      c.offeredSlotIds = [];
      c.pausedUntil = undefined;
      c.closedReason = 'Patient decided not to proceed.';
      send(s, c, k('decline'), `Understood. I’ve noted that you’ve decided not to go ahead with the crown, and I won’t send more reminders about it. If anything changes, reply here or call us at ${PRACTICE.phone}.`, { tag: 'Decision recorded' });
      event(s, c, 'patient', 'closed', 'Patient declined treatment', 'Patient decision respected and visible to the dentist. No further outreach.');
      break;
    }
    case optionId === 'stop': {
      suppressPending(s, c, 'Patient opted out of messages.');
      send(s, c, k('stop'), 'You’ve been unsubscribed from Harbor Dental follow-up texts. Reply START to opt back in.', { tag: 'Opt-out confirmed' });
      c.status = 'opted_out';
      c.stage = 'closed';
      c.offeredSlotIds = [];
      c.pausedUntil = undefined;
      c.closedReason = 'Patient replied STOP.';
      const a = activeAppt(s, c);
      event(s, c, 'patient', 'closed', 'Patient stopped messages',
        `Contact permission ended. All future outreach cancelled.${a ? ' Existing appointment kept on the schedule; no reminders will be sent.' : ''}`);
      break;
    }
    case optionId === 'start': {
      c.status = 'awaiting_reply';
      c.stage = 'intro';
      c.closedReason = undefined;
      send(s, c, k('start'), `You’re opted back in. ${provider.short} recommended a crown for your ${rec.toothPlain}. Would you like to schedule, or do you have questions first?`, { tag: 'Opt-in confirmed' });
      event(s, c, 'patient', 'resume', 'Patient opted back in', 'Contact permission restored by the patient.');
      scheduleFollowup(s, c);
      break;
    }
  }
}

// ── scheduled wake-ups ───────────────────────────────────────────────────────

function runWake(s: State, c: Case, wake: Wake, replay = false) {
  if (s.processedKeys[wake.key]) {
    event(s, c, 'coordinator', 'duplicate', 'Duplicate event ignored',
      `“${wake.label}” (key ${wake.key}) was already processed on ${fmtDateTime(s.processedKeys[wake.key])}. No message or booking was created.`);
    return;
  }
  s.processedKeys[wake.key] = s.now;
  s.lastWake = { caseId: c.id, wake };
  if (!replay && c.next?.key === wake.key) c.next = undefined;

  const { patient, rec, provider, note } = ctx(s, c);
  const k = (n: string) => `msg:${wake.key}:${n}`;
  const first = patient.firstName;

  switch (wake.type) {
    case 'outreach': {
      // Observe: is there still an unscheduled recommendation we may contact about?
      if (!canContact(c) || !isOpen(c)) return;
      if (activeAppt(s, c)) {
        event(s, c, 'coordinator', 'suppressed', 'Outreach skipped: appointment already exists', 'An existing booking suppresses scheduling messages.');
        return;
      }
      const days = Math.round((s.now - rec.recommendedOn) / DAY);
      send(s, c, k('outreach'), `Hi ${first}, this is ${PRACTICE.name}. At your ${fmtDate(rec.recommendedOn).split(', ')[1]} visit, ${provider.short} recommended a crown for your ${rec.toothPlain}. We haven’t seen it on the schedule yet, so I wanted to check in.\n\nWould you like to book a time, or do you have questions first? Reply STOP to opt out.`, { tag: 'First outreach' });
      event(s, c, 'coordinator', 'outreach', 'First outreach sent automatically',
        `Treatment plan shows a crown recommended ${days} days ago with no appointment. Contact preference: ${patient.channel.toLowerCase()}, ${patient.contactWindow.toLowerCase()}. No approval step required.`);
      c.status = 'awaiting_reply';
      c.stage = 'intro';
      c.nudgesSent = 0;
      scheduleFollowup(s, c);
      return;
    }
    case 'followup': {
      if (c.status !== 'awaiting_reply') {
        event(s, c, 'coordinator', 'suppressed', 'Follow-up skipped', `Case is ${c.status.replace('_', ' ')}; follow-up not needed.`);
        return;
      }
      if (c.nudgesSent >= MAX_FOLLOWUPS) {
        schedule(s, c, 'close_no_response', s.now, 'Close outreach (cap reached)');
        return;
      }
      c.nudgesSent += 1;
      const n = c.nudgesSent;
      const tag = `Follow-up ${n} of ${MAX_FOLLOWUPS}`;
      if (c.stage === 'offering' || c.stage === 'consult_offering') {
        const type = c.stage === 'offering' ? 'crown_prep' : 'consult';
        const slots = offer(s, c, type, 'preferred');
        send(s, c, k('fu'), `Hi ${first}, still happy to help you find a time with ${provider.short}. These are open now:\n\n${slotLines(slots)}\n\nOr reply if you’d rather I check back later.`, { tag, slotIds: slots.map((x) => x.id) });
      } else if (c.stage === 'handoff_offer') {
        send(s, c, k('fu'), `Hi ${first}, just checking in. Would a short discussion with ${provider.short} about your question help? No pressure either way.`, { tag });
      } else if (c.stage === 'post_consult') {
        send(s, c, k('fu'), `Hi ${first}, checking in after your discussion with ${provider.short}. Would you like to schedule the crown, or do you need more time? Either is fine.`, { tag });
      } else {
        send(s, c, k('fu'), `Hi ${first}, just checking in about the crown ${provider.short} recommended. I can share a few appointment times, or explain why it was recommended. Whatever helps.`, { tag });
      }
      event(s, c, 'coordinator', 'message', `${tag} sent`,
        `No reply since the last message. Records rechecked: no appointment, not paused, contact allowed. Unanswered outreach is capped at the first message plus ${MAX_FOLLOWUPS} follow-ups.`);
      if (c.nudgesSent < MAX_FOLLOWUPS) scheduleFollowup(s, c);
      else schedule(s, c, 'close_no_response', nextContactTime(withTime(s.now + CLOSE_AFTER, 10)), 'Stop outreach if still no reply');
      return;
    }
    case 'close_no_response': {
      if (c.status !== 'awaiting_reply') return;
      c.status = 'no_response';
      c.stage = 'closed';
      c.offeredSlotIds = [];
      c.closedReason = 'No reply after first message + 2 follow-ups.';
      c.lastAction = { label: 'Outreach stopped (cap)', at: s.now };
      event(s, c, 'coordinator', 'closed', 'Outreach stopped: no reply after 3 messages',
        'Cap reached (first message + 2 follow-ups). No further automated messages. A reply from the patient reopens the case.');
      return;
    }
    case 'resume': {
      // Observe again before acting: things may have changed during the pause.
      if (c.status !== 'paused') return;
      c.pausedUntil = undefined;
      if (activeAppt(s, c)) {
        c.status = 'booked';
        c.stage = 'booked';
        event(s, c, 'coordinator', 'suppressed', 'Check-back skipped: appointment already exists', 'Appointment found in the practice schedule.');
        return;
      }
      c.status = 'awaiting_reply';
      const slots = offer(s, c, 'crown_prep', 'preferred');
      const prev = s.events.filter((e) => e.caseId === c.id && e.kind === 'pause').pop();
      send(s, c, k('resume'), `Hi ${first}, checking back as you asked. ${provider.short} has these openings for your crown visit:\n\n${slotLines(slots)}\n\nTap a time to book it, or let me know if you need longer.`, {
        tag: 'Check-back with new times', slotIds: slots.map((x) => x.id), sources: { kbIds: ['kb-sched'], noteIds: [] },
      });
      event(s, c, 'coordinator', 'resume', 'Resumed after patient-requested pause',
        `Remembered the pause${prev ? ` requested ${fmtDate(prev.at)}` : ''}. Rechecked records first: no appointment, treatment not complete, contact allowed. Availability refreshed (${patient.timePreferenceLabel.toLowerCase()}).`,
        { kbIds: ['kb-sched'] });
      c.stage = 'offering';
      scheduleFollowup(s, c);
      return;
    }
    case 'reminder': {
      const a = activeAppt(s, c);
      if (!a) return;
      if (canContact(c)) {
        send(s, c, k('reminder'), `Reminder: your crown appointment with ${provider.short} is tomorrow, ${fmtDate(a.start)} at ${fmtTime(a.start)} (about 90 minutes). Reply here if you need to reschedule.`, { tag: 'Reminder sent' });
        event(s, c, 'coordinator', 'message', 'Appointment reminder sent', 'Booked appointment confirmed in the schedule the day before.');
      }
      schedule(s, c, 'visit_check', a.end, 'Check schedule after visit');
      return;
    }
    case 'visit_check': {
      const a = activeAppt(s, c);
      if (!a) return;
      a.status = 'time_passed';
      c.status = 'visit_passed';
      c.lastAction = { label: 'Visit time passed', at: s.now };
      event(s, c, 'practice', 'record', 'Appointment time passed · awaiting completion record',
        'Attendance alone does not mean the treatment is complete. The case stays open until the practice record confirms the crown is seated.',
        { kbIds: ['kb-sched'] });
      schedule(s, c, 'completion_check', withTime(addDays(s.now, 14), 9), 'Recheck completion record');
      return;
    }
    case 'completion_check': {
      if (c.status !== 'visit_passed') return;
      event(s, c, 'coordinator', 'record', 'No completion record yet · still tracking',
        'Expected seat visit window has passed without a completion entry. Visible to the front desk in the worklist; no patient message sent.');
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
      event(s, c, 'practice', 'record', `${provider.short} added a discussion note`, 'Practice record updated after the dentist discussion (simulated).', { noteIds: [consultNote.id] });
      c.status = 'awaiting_reply';
      c.stage = 'post_consult';
      send(s, c, k('post'), `It’s completely your decision. Would you like to schedule the crown, take more time, or not go ahead?`, {
        lead: `Hi ${first}, thanks for talking with ${provider.short}. Here\u2019s what was recorded from your discussion:`,
        sections: [
          { kind: 'clinician', label: `From ${provider.short}’s discussion note · ${fmtDate(a.start)}`, text: consultNote.patientSummary, refId: consultNote.id },
        ],
        tag: 'Decision check-in', sources: { kbIds: [], noteIds: [consultNote.id, note.id] },
      });
      event(s, c, 'coordinator', 'message', 'Checked in after dentist discussion',
        'Summarized only what the dentist recorded. Patient decides whether to proceed; treatment remains incomplete.', { noteIds: [consultNote.id] });
      scheduleFollowup(s, c);
      return;
    }
  }
}

/** Process every due wake-up, in time order, up to `until`. */
export function tick(s: State, until: number) {
  for (let guard = 0; guard < 500; guard++) {
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
}

// ── reviewer / practice-system events ────────────────────────────────────────

function practiceCancel(s: State, c: Case) {
  const a = activeAppt(s, c) ?? activeConsult(s, c);
  if (!a) return;
  const { patient, provider } = ctx(s, c);
  const wasConsult = a.type === 'consult';
  cancelAppointment(s, a, `${provider.short} unavailable (practice schedule change)`);
  s.blockedDays[dayKey(a.providerId, a.start)] = `${provider.short} unavailable`;
  event(s, c, 'practice', 'cancellation', `Practice schedule: ${wasConsult ? 'discussion' : 'appointment'} on ${fmtDate(a.start)} cancelled`,
    `${provider.short} is no longer available that day. Detected from the practice schedule feed; that day is removed from offered times.`);
  suppressPending(s, c, 'The appointment it depended on was cancelled.');
  if (wasConsult) c.consultAppointmentId = undefined;
  else c.appointmentId = undefined;

  if (c.status === 'opted_out' || c.status === 'paused') {
    event(s, c, 'coordinator', 'suppressed', 'Not contacting patient about the cancellation',
      c.status === 'opted_out' ? 'Patient has opted out of messages.' : 'Patient asked us to pause; we will offer new times when the pause ends.');
    return;
  }
  c.status = 'awaiting_reply';
  const type = wasConsult ? 'consult' : 'crown_prep';
  const slots = offer(s, c, type, 'preferred');
  s.now += 5 * MIN;
  send(s, c, `msg:${a.id}:practice-cancel`, `Hi ${patient.firstName}, I’m sorry, ${provider.short} is no longer available on ${fmtDate(a.start)}, so we’ve had to cancel your ${wasConsult ? 'discussion' : 'crown appointment'}. Here are the next openings:\n\n${slotLines(slots)}\n\nTap one to rebook, or I can check back with you later.`, {
    tag: 'Cancellation recovery', slotIds: slots.map((x) => x.id),
  });
  event(s, c, 'coordinator', 'resume', 'Coordination reopened after cancellation',
    'Cancellation reopens coordination unless the patient has paused or stopped messages. New times offered automatically.');
  c.stage = wasConsult ? 'consult_offering' : 'offering';
  if (wasConsult && c.handoffId) s.handoffs[c.handoffId].status = 'shared';
  scheduleFollowup(s, c);
}

function recordCompletion(s: State, c: Case) {
  if (c.status === 'completed') return;
  const { patient } = ctx(s, c);
  const a = c.appointmentId ? s.appointments[c.appointmentId] : undefined;
  if (a && a.status !== 'cancelled') a.status = 'completed';
  suppressPending(s, c, 'Treatment complete. Nothing left to follow up on.');
  const wasOptedOut = c.status === 'opted_out';
  c.next = undefined;
  event(s, c, 'practice', 'completion', 'Practice record: crown seated · treatment complete',
    'Completion confirmed by the practice record, not inferred from attendance. Case closed; all follow-up stopped.');
  if (!wasOptedOut) {
    s.now += 5 * MIN;
    send(s, c, `msg:${c.id}:completed`, `Hi ${patient.firstName}, our records show your crown treatment is complete. That’s the last message you’ll get from us about it. Thanks for taking care of it!`, { tag: 'Completion notice' });
  }
  c.status = 'completed';
  c.stage = 'closed';
  c.offeredSlotIds = [];
  c.pausedUntil = undefined;
  c.closedReason = 'Practice record confirms treatment complete.';
  c.lastAction = { label: 'Treatment completed', at: s.now };
}

// ── public API ───────────────────────────────────────────────────────────────

export function dispatch(prev: State, action: Action): State {
  const s: State = structuredClone(prev);
  switch (action.type) {
    case 'reply':
      handleReply(s, action.caseId, action.optionId);
      break;
    case 'advance':
      tick(s, s.now + action.ms);
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
    case 'replayLast':
      if (s.lastWake) runWake(s, s.cases[s.lastWake.caseId], s.lastWake.wake, true);
      break;
  }
  return s;
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
