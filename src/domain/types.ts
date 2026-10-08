// Domain model for the treatment follow-up coordinator.
// Everything here is fictional sample data driven by deterministic rules.

export type Barrier = 'unknown' | 'understanding' | 'scheduling';

export type CaseStatus =
  | 'awaiting_reply' // a message is out, or about to go out, and we are waiting on the patient
  | 'paused' // patient asked us to check back later
  | 'consult_booked' // dentist discussion is booked; treatment decision pending
  | 'booked' // treatment appointment is on the schedule
  | 'visit_passed' // appointment time passed; waiting on the practice completion record
  | 'completed' // practice record confirms treatment complete
  | 'declined' // patient decided not to proceed
  | 'opted_out' // patient asked to stop messages
  | 'no_response'; // outreach cap reached without a reply

export type Stage =
  | 'intro' // first outreach sent (or scheduled)
  | 'explained' // recommendation explained
  | 'offering' // appointment times offered
  | 'handoff_offer' // record can't answer; offered dentist discussion
  | 'consult_offering' // discussion times offered
  | 'booked'
  | 'consult_booked'
  | 'post_consult' // after dentist discussion, patient decides
  | 'paused'
  | 'closed';

export type WakeType =
  | 'outreach'
  | 'followup'
  | 'close_no_response'
  | 'resume'
  | 'reminder'
  | 'visit_check'
  | 'consult_check'
  | 'completion_check';

export interface Wake {
  type: WakeType;
  at: number;
  key: string; // idempotency key; a processed key is never acted on twice
  label: string; // human-readable "next step"
}

export type TreatmentKey = 'crown' | 'filling' | 'root_canal' | 'deep_cleaning' | 'implant' | 'bridge';

export interface Provider {
  id: string;
  name: string;
  short: string;
  role: string;
}

export interface Patient {
  id: string;
  name: string;
  firstName: string;
  age: number;
  phone: string;
  email: string;
  channel: 'text' | 'email';
  contactWindow: string; // "weekdays 9–6"
  timePreference: 'morning' | 'afternoon' | 'any';
  timePreferenceLabel: string;
  lastVisit: string;
}

export interface Recommendation {
  id: string;
  patientId: string;
  providerId: string;
  treatment: TreatmentKey;
  tooth: string; // as charted, e.g. "#30"
  area: string; // plain language, e.g. "lower right back tooth"
  recommendedOn: number;
  noteId: string;
}

export interface ClinicianNote {
  id: string;
  patientId: string;
  providerId: string;
  date: number;
  kind: 'exam' | 'consult';
  text: string; // as charted
  patientSummary: string; // prewritten plain-language summary approved for patient use
  covers: string[]; // which questions this note can answer, e.g. ['why']
}

/** One question in a practice FAQ file. `route` means: never answer, hand off instead. */
export interface FaqEntry {
  key: string;
  q: string;
  a?: string;
  route?: 'dentist' | 'front_desk';
}

export interface FaqFile {
  id: string; // "crowns"
  file: string; // "crowns.md"
  title: string;
  intro: string;
  editedBy: string;
  edited: number;
  draft?: boolean;
  entries: FaqEntry[];
}

export interface Slot {
  id: string;
  providerId: string;
  type: 'treatment' | 'consult';
  start: number;
  end: number;
}

export interface Appointment {
  id: string;
  caseId: string;
  slotId: string;
  providerId: string;
  type: 'treatment' | 'consult';
  start: number;
  end: number;
  status: 'booked' | 'cancelled' | 'time_passed' | 'completed';
  bookedAt: number;
  cancelledReason?: string;
}

/** A piece of a message. `src` marks text taken from the chart or from an FAQ file. */
export interface Part {
  t: string;
  src?: 'chart' | 'faq';
  ref?: string; // note id, or "file#key"
}

export interface Message {
  id: string;
  key: string;
  caseId: string;
  from: 'coordinator' | 'patient';
  channel: 'text' | 'email';
  at: number;
  parts: Part[];
  tag?: string; // short label for activity, e.g. "Explanation"
}

export type EventActor = 'coordinator' | 'patient' | 'practice' | 'staff';

export interface CaseEvent {
  id: string;
  caseId: string;
  at: number;
  actor: EventActor;
  kind:
    | 'outreach'
    | 'message'
    | 'explanation'
    | 'reply'
    | 'booking'
    | 'cancellation'
    | 'pause'
    | 'resume'
    | 'suppressed'
    | 'handoff'
    | 'completion'
    | 'closed'
    | 'record'
    | 'duplicate'
    | 'schedule'
    | 'found';
  title: string;
  why: string;
  refs?: { faq?: string[]; noteIds?: string[] };
}

export interface Handoff {
  id: string;
  caseId: string;
  at: number;
  to: 'dentist' | 'front_desk';
  routedTo: string; // "Dr. Bell" | "Front desk"
  question: string;
  status: 'open' | 'discussion_booked' | 'discussed' | 'resolved';
}

export interface Case {
  id: string;
  patientId: string;
  recommendationId: string;
  providerId: string;
  status: CaseStatus;
  stage: Stage;
  barrier: Barrier;
  appointmentId?: string;
  consultAppointmentId?: string;
  offeredSlotIds: string[];
  pausedUntil?: number;
  nudgesSent: number;
  next?: Wake;
  hold?: { to: 'front_desk'; reason: string; since: number }; // a person must act; no outreach meanwhile
  asked: string[];
  faqRefs: string[];
  noteRefs: string[];
  handoffId?: string;
  closedReason?: string;
}

export interface State {
  version: number;
  now: number;
  seq: number;
  providers: Record<string, Provider>;
  patients: Record<string, Patient>;
  recommendations: Record<string, Recommendation>;
  notes: Record<string, ClinicianNote>;
  faqs: Record<string, FaqFile>;
  appointments: Record<string, Appointment>;
  bookedSlots: Record<string, string>; // slotId -> appointmentId
  blockedDays: Record<string, string>; // `${providerId}:${dayStart}` -> reason
  cases: Record<string, Case>;
  caseOrder: string[];
  messages: Message[];
  events: CaseEvent[];
  handoffs: Record<string, Handoff>;
  processedKeys: Record<string, number>;
  lastWake?: { caseId: string; wake: Wake };
  lastSync: number;
}

export interface ReplyOption {
  id: string;
  label: string;
  group: 'primary' | 'slot' | 'more';
}
