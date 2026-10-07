import type {
  Appointment, Case, CaseEvent, ClinicianNote, KbEntry, Message, Patient, Provider, Recommendation, State,
} from './types';
import { DEMO_START, MIN, at } from './time';
import { getSlot } from './slots';

export const STATE_VERSION = 4;

export const PRACTICE = {
  name: 'Harbor Dental',
  address: '214 Harbor St',
  phone: '(555) 010-4400',
};

const providers: Record<string, Provider> = {
  shah: { id: 'shah', name: 'Dr. Priya Shah', short: 'Dr. Shah', role: 'General dentist, DDS' },
  bell: { id: 'bell', name: 'Dr. Marcus Bell', short: 'Dr. Bell', role: 'General dentist, DMD' },
};

const kb: Record<string, KbEntry> = {
  'kb-crown': {
    id: 'kb-crown',
    topic: 'Treatment explanations',
    title: 'Understanding a recommended crown',
    source: 'Harbor Dental patient education library · reviewed by Dr. Priya Shah',
    owner: 'Clinical lead',
    lastUpdated: at(2026, 8, 18),
    summary: 'What a crown is, and the general reasons dentists recommend one.',
    patientText:
      'A crown is a tooth-shaped cap that covers the whole visible part of a tooth. Dentists usually recommend one when a tooth has lost a lot of its natural structure (from a large filling, a crack, or a root canal), because the remaining walls are more likely to break under biting pressure. A crown holds the tooth together and spreads that pressure evenly.',
    body: [
      { heading: 'What a crown is', text: 'A crown is a custom-made cap, usually ceramic, that covers the entire chewing surface and sides of a tooth down to the gumline.' },
      { heading: 'Why dentists recommend them', text: 'Common reasons include a large or failing filling, a crack or fracture line, a tooth weakened after root canal treatment, or heavy wear. In each case the goal is to protect what is left of the tooth before it breaks further.' },
      { heading: 'What this entry does not cover', text: 'This is general information. The reason a specific patient was recommended a crown comes only from their dentist’s notes. Alternatives, timing, and risks for an individual tooth are questions for the dentist.' },
    ],
  },
  'kb-visit': {
    id: 'kb-visit',
    topic: 'Visit preparation',
    title: 'What the crown appointment involves',
    source: 'Harbor Dental patient education library · reviewed by Dr. Marcus Bell',
    owner: 'Clinical lead',
    lastUpdated: at(2026, 9, 2),
    summary: 'Step-by-step description of the crown preparation visit and the follow-up seat visit.',
    patientText:
      'The first visit takes about 90 minutes. The area is numbed, the tooth is gently shaped, a digital scan is taken, and you leave with a temporary crown. About two weeks later, a shorter visit (around 30 minutes) places the permanent crown. Most people go back to normal activities the same day; the tooth may feel a little sore for a few days.',
    body: [
      { heading: 'First visit · about 90 minutes', text: 'Local anesthetic numbs the area. The dentist shapes the tooth, takes a digital scan for the lab, and places a temporary crown.' },
      { heading: 'Second visit · about 30 minutes', text: 'Roughly two weeks later the permanent crown is checked for fit and bite, then bonded in place. The front desk books this visit at the end of the first one.' },
      { heading: 'Afterwards', text: 'Mild soreness for a few days is common. Avoid very sticky foods on the temporary crown. Call the office if the bite feels high or the temporary comes loose.' },
    ],
  },
  'kb-sched': {
    id: 'kb-sched',
    topic: 'Scheduling & operations',
    title: 'Scheduling requirements for crown treatment',
    source: 'Front desk scheduling policy',
    owner: 'Office manager',
    lastUpdated: at(2026, 9, 30),
    summary: 'Which provider, how long, how far ahead, and what counts as treatment complete.',
    patientText:
      'Plan for about 90 minutes with your dentist. The front desk will book the short second visit for the permanent crown while you’re here. If you need to change the time, please let us know at least 24 hours ahead.',
    body: [
      { heading: 'Provider and length', text: 'Crown preparation is booked as a 90-minute block with the treating dentist. Hygienist columns are not eligible.' },
      { heading: 'Lead time', text: 'Offer appointments at least 24 hours out so the lab and operatory can be prepared.' },
      { heading: 'Dentist discussion', text: 'A 20-minute discussion (in office or by phone) can be booked with the treating dentist when a patient has questions the record does not answer.' },
      { heading: 'Completion', text: 'Treatment is complete when the permanent crown is seated and charted. Attending the preparation visit alone does not complete the case.' },
    ],
  },
};

function patient(
  id: string, name: string, age: number, phone: string,
  timePreference: Patient['timePreference'], lastVisit: string, visitHistory: Patient['visitHistory'],
): Patient {
  const [first, last] = name.split(' ');
  return {
    id, name, firstName: first, initials: first[0] + last[0], age, phone,
    channel: 'Text message', contactWindow: 'Weekdays, 9 AM – 6 PM',
    timePreference,
    timePreferenceLabel: timePreference === 'morning' ? 'Mornings' : timePreference === 'afternoon' ? 'Afternoons' : 'No preference',
    lastVisit, visitHistory,
  };
}

const patients: Record<string, Patient> = {
  maya: patient('maya', 'Maya Chen', 38, '(555) 014-2231', 'morning', 'Sep 28, 2026', [
    { date: 'Sep 28, 2026', summary: 'Periodic exam & cleaning · Dr. Shah · crown recommended on #30' },
    { date: 'Mar 30, 2026', summary: 'Cleaning · no new findings' },
  ]),
  daniel: patient('daniel', 'Daniel Okafor', 52, '(555) 014-7720', 'afternoon', 'Sep 21, 2026', [
    { date: 'Sep 21, 2026', summary: 'Exam · Dr. Shah · crown recommended on #3' },
    { date: 'Feb 11, 2025', summary: 'Root canal treatment on #3 (endodontist referral)' },
  ]),
  elena: patient('elena', 'Elena Ruiz', 45, '(555) 014-3308', 'any', 'Sep 24, 2026', [
    { date: 'Sep 24, 2026', summary: 'Exam · Dr. Bell · crown recommended on #19' },
    { date: 'Apr 2, 2026', summary: 'Cleaning · watch #19 filling' },
  ]),
  james: patient('james', 'James Whitfield', 61, '(555) 014-9013', 'morning', 'Sep 14, 2026', [
    { date: 'Sep 14, 2026', summary: 'Exam · Dr. Bell · crown recommended on #18' },
  ]),
  aisha: patient('aisha', 'Aisha Rahman', 29, '(555) 014-5562', 'afternoon', 'Sep 16, 2026', [
    { date: 'Sep 16, 2026', summary: 'Exam · Dr. Shah · crown recommended on #31' },
  ]),
  robert: patient('robert', 'Robert Lindqvist', 67, '(555) 014-1187', 'any', 'Sep 18, 2026', [
    { date: 'Sep 18, 2026', summary: 'Exam · Dr. Shah · crown recommended on #14' },
  ]),
  grace: patient('grace', 'Grace Park', 44, '(555) 014-6650', 'morning', 'Oct 2, 2026', [
    { date: 'Oct 2, 2026', summary: 'Crown seated on #3 · Dr. Bell' },
    { date: 'Sep 17, 2026', summary: 'Crown preparation on #3 · Dr. Bell' },
  ]),
  tom: patient('tom', 'Tom Becker', 36, '(555) 014-2045', 'any', 'Sep 10, 2026', [
    { date: 'Sep 10, 2026', summary: 'Emergency visit · Dr. Bell · crown recommended on #12' },
  ]),
  sofia: patient('sofia', 'Sofia Martins', 58, '(555) 014-3391', 'any', 'Sep 8, 2026', [
    { date: 'Sep 8, 2026', summary: 'Exam · Dr. Shah · crown recommended on #2' },
  ]),
};

function rec(id: string, providerId: string, tooth: string, toothPlain: string, recommendedOn: number): Recommendation {
  return { id: `rec-${id}`, patientId: id, providerId, treatment: 'Crown', tooth, toothPlain, recommendedOn, appointmentType: 'crown_prep', noteId: `note-${id}` };
}

const recommendations: Record<string, Recommendation> = Object.fromEntries(
  [
    rec('maya', 'shah', '#30 · lower right first molar', 'lower right back tooth (#30)', at(2026, 9, 28)),
    rec('daniel', 'shah', '#3 · upper right first molar', 'upper right back tooth (#3)', at(2026, 9, 21)),
    rec('elena', 'bell', '#19 · lower left first molar', 'lower left back tooth (#19)', at(2026, 9, 24)),
    rec('james', 'bell', '#18 · lower left second molar', 'lower left back tooth (#18)', at(2026, 9, 14)),
    rec('aisha', 'shah', '#31 · lower right second molar', 'lower right back tooth (#31)', at(2026, 9, 16)),
    rec('robert', 'shah', '#14 · upper left first molar', 'upper left back tooth (#14)', at(2026, 9, 18)),
    rec('grace', 'bell', '#3 · upper right first molar', 'upper right back tooth (#3)', at(2026, 8, 20)),
    rec('tom', 'bell', '#12 · upper left first premolar', 'upper left tooth (#12)', at(2026, 9, 10)),
    rec('sofia', 'shah', '#2 · upper right second molar', 'upper right back tooth (#2)', at(2026, 9, 8)),
  ].map((r) => [r.id, r]),
);

function note(id: string, providerId: string, date: number, text: string, patientSummary: string): ClinicianNote {
  return { id: `note-${id}`, patientId: id, providerId, date, kind: 'exam', text, patientSummary, covers: ['why'] };
}

const notes: Record<string, ClinicianNote> = Object.fromEntries(
  [
    note('maya', 'shah', at(2026, 9, 28),
      '#30: large MOD amalgam (~15 yrs) with visible fracture line on DL cusp. Pt reports sensitivity on chewing. No periapical findings on PA. Recommend full-coverage crown to protect remaining tooth structure. Discussed briefly chairside; pt wanted time to think.',
      'At your Sep 28 visit, Dr. Shah noted that your lower right back tooth (#30) has a large, older filling and a crack line in one of its cusps, and that you mentioned it feels sensitive when you chew. Dr. Shah recommended a crown to cover and protect the rest of the tooth.'),
    note('daniel', 'shah', at(2026, 9, 21),
      '#3: RCT completed 02/2025 (endo referral), large composite access fill. Recommend crown to protect RCT-treated tooth. Pt agreeable, will schedule.',
      'At your Sep 21 visit, Dr. Shah noted that your upper right back tooth (#3) had a root canal last year and now has a large filling. Dr. Shah recommended a crown to protect it, which is standard after a root canal on a back tooth.'),
    note('elena', 'bell', at(2026, 9, 24),
      '#19: large failing composite, recurrent decay at distal margin, ML cusp undermined. Recommend crown. Pt hesitant.',
      'At your Sep 24 visit, Dr. Bell noted that the large filling in your lower left back tooth (#19) is breaking down, with new decay along one edge, and that one of the tooth’s cusps has little support underneath it. Dr. Bell recommended a crown to rebuild and protect the tooth.'),
    note('james', 'bell', at(2026, 9, 14), '#18: cracked cusp, symptomatic to bite. Recommend crown.', 'Dr. Bell noted a cracked cusp on your lower left back tooth (#18) and recommended a crown to protect it.'),
    note('aisha', 'shah', at(2026, 9, 16), '#31: large amalgam with craze lines. Recommend crown.', 'Dr. Shah noted a large filling with small crack lines on your lower right back tooth (#31) and recommended a crown.'),
    note('robert', 'shah', at(2026, 9, 18), '#14: fractured cusp, existing large filling. Recommend crown.', 'Dr. Shah noted a broken cusp on your upper left back tooth (#14) and recommended a crown.'),
    note('grace', 'bell', at(2026, 8, 20), '#3: post-RCT, recommend crown.', 'Dr. Bell recommended a crown on your upper right back tooth (#3) after your root canal.'),
    note('tom', 'bell', at(2026, 9, 10), '#12: fractured buccal cusp. Recommend crown.', 'Dr. Bell noted a broken cusp on #12 and recommended a crown.'),
    note('sofia', 'shah', at(2026, 9, 8), '#2: large failing amalgam. Recommend crown.', 'Dr. Shah noted a large failing filling on #2 and recommended a crown.'),
  ].map((n) => [n.id, n]),
);

/** Notes the practice adds after a dentist discussion. They enter the record only when that visit happens. */
export const CONSULT_NOTES: Record<string, Omit<ClinicianNote, 'date'>> = {
  default: {
    id: 'note-consult', patientId: '', providerId: '', kind: 'consult',
    text: 'Discussed pt questions re: recommended crown. Recommendation unchanged. Pt to decide on next steps.',
    patientSummary: 'Your dentist’s note from the discussion says your questions were talked through and that a crown is still the recommendation.',
    covers: ['why'],
  },
  elena: {
    id: 'note-elena-consult', patientId: 'elena', providerId: 'bell', kind: 'consult',
    text: 'Phone discussion re: #19. Pt asked whether a large filling could be done instead. Explained a replacement filling is possible short term but carries higher risk of cusp fracture given remaining structure; crown remains recommended. Pt understands options; will decide.',
    patientSummary: 'Dr. Bell’s note from your discussion says a new filling is possible in the short term, but with more risk of the weakened cusp breaking, so a crown is still the recommendation. The note also says the decision is yours.',
    covers: ['why', 'alt'],
  },
};

type CaseSeed = Partial<Case> & Pick<Case, 'id' | 'status' | 'stage' | 'barrier' | 'script'>;

function mkCase(c: CaseSeed): Case {
  const r = recommendations[`rec-${c.id}`];
  return {
    patientId: c.id, recommendationId: r.id, providerId: r.providerId,
    offeredSlotIds: [], slotCursor: 0, nudgesSent: 0, kbRefs: [], noteRefs: [], asked: [],
    ...c,
  };
}

export function seedState(): State {
  const state: State = {
    version: STATE_VERSION,
    now: DEMO_START,
    seq: 100,
    providers: structuredClone(providers),
    patients: structuredClone(patients),
    recommendations: structuredClone(recommendations),
    notes: structuredClone(notes),
    kb: structuredClone(kb),
    appointments: {},
    bookedSlots: {},
    blockedDays: {},
    cases: {},
    caseOrder: [],
    messages: [],
    events: [],
    handoffs: {},
    processedKeys: {},
  };

  let n = 0;
  const msg = (caseId: string, from: Message['from'], when: number, text: string, extra: Partial<Message> = {}) => {
    const key = `seed:msg:${caseId}:${++n}`;
    state.messages.push({ id: `m-seed-${n}`, key, caseId, from, at: when, text, ...extra });
    state.processedKeys[key] = when;
  };
  const ev = (caseId: string, when: number, actor: CaseEvent['actor'], kind: CaseEvent['kind'], title: string, why: string) => {
    state.events.push({ id: `e-seed-${++n}`, caseId, at: when, actor, kind, title, why });
  };
  const addCase = (c: Case) => {
    state.cases[c.id] = c;
    state.caseOrder.push(c.id);
  };

  // ── Demo cases: outreach fires automatically when the clock starts ─────────
  for (const [id, script] of [['maya', 'main'], ['daniel', 'scheduling'], ['elena', 'clarify']] as const) {
    const r = recommendations[`rec-${id}`];
    addCase(mkCase({
      id, script, status: 'awaiting_reply', stage: 'intro', barrier: 'unknown',
      next: { type: 'outreach', at: DEMO_START, key: `wake:outreach:${id}`, label: 'Send first outreach' },
    }));
    ev(id, r.recommendedOn + 8 * 60 * MIN, 'practice', 'record',
      'Crown recommended in treatment plan',
      `${providers[r.providerId].name} recorded a crown on ${r.tooth.split(' ·')[0]}. Exported from the practice record with the clinician note.`);
  }

  // ── Background cases: realistic history to show the practice-wide picture ──
  // James: unanswered. Initial + follow-up 1 sent; follow-up 2 is due, then the cap closes outreach.
  addCase(mkCase({
    id: 'james', script: 'background', status: 'awaiting_reply', stage: 'intro', barrier: 'unknown', nudgesSent: 1,
    lastAction: { label: 'Follow-up 1 of 2 sent', at: at(2026, 10, 8, 10) },
    next: { type: 'followup', at: at(2026, 10, 12, 10), key: 'wake:followup:james:seed', label: 'Send follow-up 2 of 2' },
  }));
  ev('james', at(2026, 9, 14, 16), 'practice', 'record', 'Crown recommended in treatment plan', 'Dr. Marcus Bell recorded a crown on #18.');
  msg('james', 'coordinator', at(2026, 10, 5, 10), 'Hi James, this is Harbor Dental. At your Sep 14 visit, Dr. Bell recommended a crown for a lower left back tooth (#18). We haven’t seen it on the schedule yet. Would you like to book, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  ev('james', at(2026, 10, 5, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation from Sep 14 had no appointment after 21 days. Contact preference: text, weekdays 9–6.');
  msg('james', 'coordinator', at(2026, 10, 8, 10), 'Hi James, just checking in about the crown Dr. Bell recommended. I can share a few appointment times, or answer questions about why it was recommended.', { tag: 'Follow-up 1 of 2' });
  ev('james', at(2026, 10, 8, 10), 'coordinator', 'message', 'Follow-up 1 of 2 sent', 'No reply in 3 days. Unanswered outreach is capped at the first message plus two follow-ups.');

  // Aisha: paused until after exams.
  addCase(mkCase({
    id: 'aisha', script: 'background', status: 'paused', stage: 'paused', barrier: 'scheduling',
    pausedUntil: at(2026, 10, 22, 10),
    lastAction: { label: 'Pause confirmed', at: at(2026, 10, 1, 14, 5) },
    next: { type: 'resume', at: at(2026, 10, 22, 10), key: 'wake:resume:aisha:seed', label: 'Check back (patient request)' },
  }));
  ev('aisha', at(2026, 9, 16, 15), 'practice', 'record', 'Crown recommended in treatment plan', 'Dr. Priya Shah recorded a crown on #31.');
  msg('aisha', 'coordinator', at(2026, 9, 30, 10), 'Hi Aisha, this is Harbor Dental. At your Sep 16 visit, Dr. Shah recommended a crown for a lower right back tooth (#31). Would you like to book a time, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  ev('aisha', at(2026, 9, 30, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation from Sep 16 had no appointment after 14 days.');
  msg('aisha', 'patient', at(2026, 10, 1, 14), 'I have exams until the 21st. Can you check back after that?');
  ev('aisha', at(2026, 10, 1, 14), 'patient', 'reply', 'Patient asked to pause until after Oct 21', 'Barrier recorded as scheduling.');
  msg('aisha', 'coordinator', at(2026, 10, 1, 14, 5), 'Of course. I’ll check back on Thu, Oct 22, and you won’t hear from us about this before then. If you’re ready sooner, just reply here.', { tag: 'Pause confirmed' });
  ev('aisha', at(2026, 10, 1, 14, 5), 'coordinator', 'pause', 'Paused until Thu, Oct 22', 'Patient-requested pause. Follow-up planned for Oct 5 cancelled; no messages until the requested date.');

  // Robert: booked via the coordinator.
  const robertSlot = getSlot('shah-crown_prep-20261015-1330')!;
  const robertAppt: Appointment = {
    id: 'appt-robert-1', caseId: 'robert', slotId: robertSlot.id, providerId: 'shah', type: 'crown_prep',
    start: robertSlot.start, end: robertSlot.end, status: 'booked', bookedAt: at(2026, 10, 6, 11, 2),
  };
  state.appointments[robertAppt.id] = robertAppt;
  state.bookedSlots[robertSlot.id] = robertAppt.id;
  addCase(mkCase({
    id: 'robert', script: 'background', status: 'booked', stage: 'booked', barrier: 'scheduling', appointmentId: robertAppt.id,
    kbRefs: ['kb-sched'],
    lastAction: { label: 'Booking confirmed', at: at(2026, 10, 6, 11, 2) },
    next: { type: 'reminder', at: at(2026, 10, 14, 17), key: 'wake:reminder:robert:seed', label: 'Send appointment reminder' },
  }));
  ev('robert', at(2026, 9, 18, 11), 'practice', 'record', 'Crown recommended in treatment plan', 'Dr. Priya Shah recorded a crown on #14.');
  msg('robert', 'coordinator', at(2026, 10, 5, 10), 'Hi Robert, this is Harbor Dental. At your Sep 18 visit, Dr. Shah recommended a crown for an upper left back tooth (#14). Would you like to book, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  ev('robert', at(2026, 10, 5, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation had no appointment after 17 days.');
  msg('robert', 'patient', at(2026, 10, 6, 10, 55), 'I’m ready to schedule');
  msg('robert', 'coordinator', at(2026, 10, 6, 11, 2), 'You’re booked: Thu, Oct 15 at 1:30 PM with Dr. Shah (about 90 minutes) at Harbor Dental, 214 Harbor St. I’ll send a reminder the day before.', { tag: 'Booking confirmed', sources: { kbIds: ['kb-sched'], noteIds: [] } });
  ev('robert', at(2026, 10, 6, 11, 2), 'coordinator', 'booking', 'Crown appointment booked · Thu, Oct 15, 1:30 PM', 'Patient chose a slot that meets the scheduling requirements (treating dentist, 90-minute block, at least 24 hours out).');

  // Grace: completed.
  addCase(mkCase({
    id: 'grace', script: 'background', status: 'completed', stage: 'closed', barrier: 'understanding',
    kbRefs: ['kb-crown'], noteRefs: ['note-grace'],
    lastAction: { label: 'Treatment completed', at: at(2026, 10, 2, 16) },
    closedReason: 'Practice record confirms crown seated Oct 2.',
  }));
  ev('grace', at(2026, 9, 3, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation from Aug 20 had no appointment after 14 days.');
  msg('grace', 'coordinator', at(2026, 9, 3, 10), 'Hi Grace, this is Harbor Dental. Dr. Bell recommended a crown for an upper right back tooth (#3). Would you like to book, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  msg('grace', 'patient', at(2026, 9, 3, 12), 'Why do I need a crown?');
  msg('grace', 'coordinator', at(2026, 9, 3, 12, 1), 'Dr. Bell recommended a crown on your upper right back tooth (#3) after your root canal. A crown holds the tooth together and spreads biting pressure evenly.', { tag: 'Explanation', sources: { kbIds: ['kb-crown'], noteIds: ['note-grace'] } });
  ev('grace', at(2026, 9, 3, 12, 1), 'coordinator', 'explanation', 'Recommendation explained', 'Patient asked why. Answered from the clinician note and practice guide.');
  ev('grace', at(2026, 9, 3, 12, 5), 'coordinator', 'booking', 'Crown appointment booked · Thu, Sep 17', 'Patient chose a valid slot.');
  ev('grace', at(2026, 9, 17, 11), 'practice', 'record', 'Preparation visit attended', 'Attendance noted. Case stays open until completion is recorded.');
  ev('grace', at(2026, 10, 2, 16), 'practice', 'completion', 'Practice record: crown seated', 'Completion confirmed by the practice record. Follow-up closed.');
  msg('grace', 'coordinator', at(2026, 10, 2, 16, 5), 'Hi Grace, our records show your crown treatment is complete. That’s the last message you’ll get from us about it. Thanks for taking care of it!', { tag: 'Completion notice' });

  // Tom: opted out.
  addCase(mkCase({
    id: 'tom', script: 'background', status: 'opted_out', stage: 'closed', barrier: 'unknown',
    lastAction: { label: 'Opt-out confirmed', at: at(2026, 10, 3, 9, 41) },
    closedReason: 'Patient replied STOP.',
  }));
  msg('tom', 'coordinator', at(2026, 10, 2, 10), 'Hi Tom, this is Harbor Dental. Dr. Bell recommended a crown for an upper left tooth (#12). Would you like to book, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  ev('tom', at(2026, 10, 2, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation from Sep 10 had no appointment after 22 days.');
  msg('tom', 'patient', at(2026, 10, 3, 9, 40), 'STOP');
  msg('tom', 'coordinator', at(2026, 10, 3, 9, 41), 'You’ve been unsubscribed from Harbor Dental follow-up texts. Reply START to opt back in.', { tag: 'Opt-out confirmed' });
  ev('tom', at(2026, 10, 3, 9, 41), 'patient', 'closed', 'Patient stopped messages', 'Contact permission ended. All future outreach cancelled.');

  // Sofia: declined.
  addCase(mkCase({
    id: 'sofia', script: 'background', status: 'declined', stage: 'closed', barrier: 'understanding',
    kbRefs: ['kb-crown'], noteRefs: ['note-sofia'],
    lastAction: { label: 'Decision recorded', at: at(2026, 9, 29, 15, 10) },
    closedReason: 'Patient decided not to proceed.',
  }));
  msg('sofia', 'coordinator', at(2026, 9, 25, 10), 'Hi Sofia, this is Harbor Dental. Dr. Shah recommended a crown for an upper right back tooth (#2). Would you like to book, or do you have questions first? Reply STOP to opt out.', { tag: 'First outreach' });
  ev('sofia', at(2026, 9, 25, 10), 'coordinator', 'outreach', 'First outreach sent automatically', 'Recommendation from Sep 8 had no appointment after 17 days.');
  msg('sofia', 'patient', at(2026, 9, 29, 15, 8), 'I’ve decided not to go ahead');
  msg('sofia', 'coordinator', at(2026, 9, 29, 15, 10), 'Understood. I’ve noted that you’ve decided not to go ahead with the crown, and I won’t send more reminders about it. If anything changes, reply here or call us at (555) 010-4400.', { tag: 'Decision recorded' });
  ev('sofia', at(2026, 9, 29, 15, 10), 'patient', 'closed', 'Patient declined treatment', 'Patient decision respected. No further outreach.');

  state.events.sort((a, b) => a.at - b.at);
  state.messages.sort((a, b) => a.at - b.at);
  return state;
}
