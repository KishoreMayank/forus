import type { Case, ClinicianNote, Patient, Provider, Recommendation, State, TreatmentKey } from './types';
import { FAQ_FILES } from './catalog';
import { DEMO_START, at } from './time';

export const STATE_VERSION = 10;

export const PRACTICE = {
  name: 'Harbor Dental',
  address: '214 Harbor St',
  phone: '(555) 010-4400',
  textNumber: '(555) 010-4400',
  email: 'hello@harbordental.example',
};

const providers: Record<string, Provider> = {
  shah: { id: 'shah', name: 'Dr. Priya Shah', short: 'Dr. Shah', role: 'General dentist' },
  bell: { id: 'bell', name: 'Dr. Marcus Bell', short: 'Dr. Bell', role: 'General dentist' },
};

interface PatientSeed {
  id: string; name: string; age: number; phone: string; channel?: 'text' | 'email';
  pref: Patient['timePreference']; lastVisit: string;
  treatment: TreatmentKey; dr: 'shah' | 'bell'; tooth: string; area: string; recommendedOn: number;
  chart: string; summary: string;
  outreachAt: number;
}

// Eleven sample patients. Each one's history is played through the engine in init.ts.
export const PATIENTS: PatientSeed[] = [
  { id: 'maya', name: 'Maya Chen', age: 38, phone: '(555) 014-2231', pref: 'morning', lastVisit: '28 Sep · exam & cleaning',
    treatment: 'crown', dr: 'shah', tooth: '#30', area: 'lower right back tooth', recommendedOn: at(2026, 9, 28),
    chart: '#30: large MOD amalgam (~15 yrs) with visible fracture line on DL cusp. Pt reports sensitivity on chewing. Recommend full-coverage crown to protect remaining tooth structure.',
    summary: 'Dr. Shah noted a large, older filling and a crack line in one of the cusps, and that it’s sensitive when you chew.',
    outreachAt: at(2026, 10, 12, 9, 5) },
  { id: 'daniel', name: 'Daniel Okafor', age: 52, phone: '(555) 014-7720', pref: 'afternoon', lastVisit: '21 Sep · exam',
    treatment: 'crown', dr: 'shah', tooth: '#3', area: 'upper right back tooth', recommendedOn: at(2026, 9, 21),
    chart: '#3: RCT completed 02/2025, large composite access fill. Recommend crown to protect RCT-treated tooth.',
    summary: 'Dr. Shah noted that the tooth had a root canal last year and now has a large filling. A crown protects it.',
    outreachAt: at(2026, 10, 9, 10) },
  { id: 'elena', name: 'Elena Ruiz', age: 45, phone: '(555) 014-3308', pref: 'any', lastVisit: '24 Sep · exam',
    treatment: 'crown', dr: 'bell', tooth: '#19', area: 'lower left back tooth', recommendedOn: at(2026, 9, 24),
    chart: '#19: large failing composite, recurrent decay at distal margin, ML cusp undermined. Recommend crown. Pt hesitant.',
    summary: 'Dr. Bell noted that the large filling is breaking down, with new decay along one edge, and that one cusp has little support left.',
    outreachAt: at(2026, 10, 5, 10) },
  { id: 'james', name: 'James Whitfield', age: 61, phone: '(555) 014-9013', pref: 'morning', lastVisit: '14 Sep · exam',
    treatment: 'root_canal', dr: 'bell', tooth: '#18', area: 'lower left back tooth', recommendedOn: at(2026, 9, 14),
    chart: '#18: deep crack into pulp, symptomatic to bite. Recommend RCT.',
    summary: 'Dr. Bell noted a deep crack reaching the nerve, and that it aches when you bite.',
    outreachAt: at(2026, 10, 5, 10) },
  { id: 'aisha', name: 'Aisha Rahman', age: 29, phone: '(555) 014-5562', pref: 'afternoon', lastVisit: '16 Sep · exam',
    treatment: 'filling', dr: 'shah', tooth: '#31', area: 'lower right back tooth', recommendedOn: at(2026, 9, 16),
    chart: '#31: small interproximal cavity. Recommend composite filling.',
    summary: 'Dr. Shah noted a small cavity between two back teeth.',
    outreachAt: at(2026, 9, 30, 10) },
  { id: 'nora', name: 'Nora Kim', age: 34, phone: '(555) 014-8812', pref: 'any', lastVisit: '29 Sep · cleaning',
    treatment: 'deep_cleaning', dr: 'bell', tooth: 'UL, LR', area: 'gums', recommendedOn: at(2026, 9, 29),
    chart: 'Perio charting: 5–6 mm pockets UL and LR, bleeding on probing. Recommend SRP, 2 quadrants.',
    summary: 'Dr. Bell’s notes show deeper gum pockets in two areas, with some bleeding.',
    outreachAt: at(2026, 10, 12, 10) },
  { id: 'leo', name: 'Leo Brandt', age: 57, phone: '(555) 014-2290', channel: 'email', pref: 'morning', lastVisit: '30 Sep · consult',
    treatment: 'implant', dr: 'shah', tooth: '#15', area: 'missing upper left back tooth', recommendedOn: at(2026, 9, 30),
    chart: '#15 missing since 2024. CBCT reviewed. Recommend implant placement.',
    summary: 'Dr. Shah reviewed your scan and recommended an implant to replace the missing tooth.',
    outreachAt: at(2026, 10, 13, 9) },
  { id: 'omar', name: 'Omar Haddad', age: 49, phone: '(555) 014-4127', pref: 'afternoon', lastVisit: '26 Sep · exam',
    treatment: 'crown', dr: 'bell', tooth: '#31', area: 'lower right back tooth', recommendedOn: at(2026, 9, 26),
    chart: '#31: large failing amalgam, cusp fracture risk. Recommend crown.',
    summary: 'Dr. Bell noted a large, failing filling with a risk of the tooth cracking.',
    outreachAt: at(2026, 10, 9, 10) },
  { id: 'robert', name: 'Robert Lindqvist', age: 67, phone: '(555) 014-1187', pref: 'any', lastVisit: '18 Sep · exam',
    treatment: 'bridge', dr: 'shah', tooth: '#14', area: 'missing upper left tooth', recommendedOn: at(2026, 9, 18),
    chart: '#14 missing; #13, #15 crowned. Recommend 3-unit bridge.',
    summary: 'Dr. Shah recommended a bridge to fill the gap, using the crowned teeth on either side.',
    outreachAt: at(2026, 10, 5, 10) },
  { id: 'sam', name: 'Sam Patel', age: 41, phone: '(555) 014-6604', pref: 'morning', lastVisit: '22 Sep · exam',
    treatment: 'filling', dr: 'shah', tooth: '#4', area: 'upper right tooth', recommendedOn: at(2026, 9, 22),
    chart: '#4: cavity on the distal surface. Recommend composite filling.',
    summary: 'Dr. Shah noted a cavity on the side of the tooth.',
    outreachAt: at(2026, 10, 9, 10) },
  { id: 'hana', name: 'Hana Sato', age: 33, phone: '(555) 014-7351', pref: 'morning', lastVisit: '25 Sep · cleaning',
    treatment: 'deep_cleaning', dr: 'bell', tooth: 'LL', area: 'gums', recommendedOn: at(2026, 9, 25),
    chart: 'Perio: 5 mm pockets LL, light bleeding. Recommend SRP.',
    summary: 'Dr. Bell noted some deeper gum pockets on the lower left.',
    outreachAt: at(2026, 10, 9, 10) },
];

/** Notes the practice adds after a dentist call. They enter the chart only when the call happens. */
export const CONSULT_NOTES: Record<string, Omit<ClinicianNote, 'date'>> = {
  default: {
    id: 'note-consult', patientId: '', providerId: '', kind: 'consult',
    text: 'Discussed pt questions re: recommendation. Recommendation unchanged. Pt to decide.',
    patientSummary: 'The note from your call says your questions were talked through and the recommendation is unchanged.',
    covers: ['why'],
  },
  elena: {
    id: 'note-elena-consult', patientId: 'elena', providerId: 'bell', kind: 'consult',
    text: 'Phone call re: #19. Pt asked whether a large filling could be done instead. Explained a filling is possible short term but carries higher risk of cusp fracture; crown remains recommended. Pt to decide.',
    patientSummary: 'Dr. Bell’s note says a new filling is possible in the short term, but with more risk of the weakened cusp breaking, so a crown is still the recommendation. The decision is yours.',
    covers: ['why', 'alt'],
  },
};

export function seedState(): State {
  const state: State = {
    version: STATE_VERSION,
    now: at(2026, 9, 30, 9),
    seq: 100,
    providers: structuredClone(providers),
    patients: {},
    recommendations: {},
    notes: {},
    faqs: Object.fromEntries(structuredClone(FAQ_FILES).map((f) => [f.id, f])),
    appointments: {},
    bookedSlots: {},
    blockedDays: {},
    cases: {},
    caseOrder: [],
    messages: [],
    events: [],
    handoffs: {},
    processedKeys: {},
    lastSync: DEMO_START - 26 * 60_000,
  };

  for (const p of PATIENTS) {
    const [first, last] = p.name.split(' ');
    state.patients[p.id] = {
      id: p.id, name: p.name, firstName: first, age: p.age, phone: p.phone,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      channel: p.channel ?? 'text', contactWindow: 'weekdays 9–6', timePreference: p.pref,
      timePreferenceLabel: p.pref === 'morning' ? 'Mornings' : p.pref === 'afternoon' ? 'Afternoons' : 'Any time',
      lastVisit: p.lastVisit,
    };
    const rec: Recommendation = {
      id: `rec-${p.id}`, patientId: p.id, providerId: p.dr, treatment: p.treatment, tooth: p.tooth, area: p.area,
      recommendedOn: p.recommendedOn, noteId: `note-${p.id}`,
    };
    state.recommendations[rec.id] = rec;
    state.notes[rec.noteId] = {
      id: rec.noteId, patientId: p.id, providerId: p.dr, date: p.recommendedOn, kind: 'exam',
      text: p.chart, patientSummary: p.summary, covers: ['why'],
    };
    const c: Case = {
      id: p.id, patientId: p.id, recommendationId: rec.id, providerId: p.dr,
      status: 'awaiting_reply', stage: 'intro', barrier: 'unknown',
      offeredSlotIds: [], nudgesSent: 0, asked: [], faqRefs: [], noteRefs: [],
      next: { type: 'outreach', at: p.outreachAt, key: `wake:outreach:${p.id}`, label: p.channel === 'email' ? 'First email' : 'First text' },
    };
    state.cases[c.id] = c;
    state.caseOrder.push(c.id);
    // Found by the chart sync on the morning of the first message (or this morning, if it hasn't gone out yet).
    const found = new Date(Math.min(p.outreachAt, DEMO_START));
    found.setHours(9, 4, 0, 0);
    state.events.push({
      id: `e-found-${p.id}`, caseId: p.id, at: found.getTime(), actor: 'practice', kind: 'found',
      title: 'Found in patient chart', why: 'Treatment recommended, nothing booked.',
    });
  }
  state.events.sort((a, b) => a.at - b.at);
  return state;
}
