import type {
  Case, CaseEvent, ClinicianNote, KbEntry, Patient, Provider, Recommendation, State,
} from './types';
import { DEMO_START, MIN, at } from './time';

export const STATE_VERSION = 5;

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
};

function rec(id: string, providerId: string, tooth: string, toothPlain: string, recommendedOn: number): Recommendation {
  return { id: `rec-${id}`, patientId: id, providerId, treatment: 'Crown', tooth, toothPlain, recommendedOn, appointmentType: 'crown_prep', noteId: `note-${id}` };
}

const recommendations: Record<string, Recommendation> = Object.fromEntries(
  [
    rec('maya', 'shah', '#30 · lower right first molar', 'lower right back tooth (#30)', at(2026, 9, 28)),
    rec('daniel', 'shah', '#3 · upper right first molar', 'upper right back tooth (#3)', at(2026, 9, 21)),
    rec('elena', 'bell', '#19 · lower left first molar', 'lower left back tooth (#19)', at(2026, 9, 24)),
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

  state.events.sort((a, b) => a.at - b.at);
  state.messages.sort((a, b) => a.at - b.at);
  return state;
}
