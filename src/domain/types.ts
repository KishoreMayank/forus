// Domain model for the treatment follow-up coordinator.
// Everything here is fictional sample data driven by deterministic rules.

export type Barrier = 'unknown' | 'understanding' | 'scheduling';

export type CaseStatus =
  | 'awaiting_reply' // a message is out and we are waiting on the patient
  | 'paused' // patient asked us to check back later
  | 'consult_booked' // dentist discussion is booked; treatment decision pending
  | 'booked' // treatment appointment is on the schedule
  | 'visit_passed' // appointment time passed; waiting on the practice completion record
  | 'completed' // practice record confirms treatment complete
  | 'declined' // patient decided not to proceed
  | 'opted_out' // patient asked to stop messages
  | 'no_response'; // outreach cap reached without a reply

export type Stage =
  | 'intro' // first outreach sent
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
  label: string; // human-readable "next action"
}

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
  initials: string;
  age: number;
  phone: string;
  channel: 'Text message';
  contactWindow: string;
  timePreference: 'morning' | 'afternoon' | 'any';
  timePreferenceLabel: string;
  lastVisit: string;
  visitHistory: { date: string; summary: string }[];
}

export interface Recommendation {
  id: string;
  patientId: string;
  providerId: string;
  treatment: string; // "Crown"
  tooth: string; // "#30 · lower right first molar"
  toothPlain: string; // "lower right back tooth"
  recommendedOn: number;
  appointmentType: 'crown_prep';
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
  covers: string[]; // what this note can answer, e.g. ['why']
}

export interface KbEntry {
  id: string;
  topic: string;
  title: string;
  source: string;
  owner: string;
  lastUpdated: number;
  summary: string;
  patientText: string; // prewritten general explanation used in messages
  body: { heading: string; text: string }[];
}

export interface Slot {
  id: string;
  providerId: string;
  type: 'crown_prep' | 'consult';
  start: number;
  end: number;
}

export interface Appointment {
  id: string;
  caseId: string;
  slotId: string;
  providerId: string;
  type: 'crown_prep' | 'consult';
  start: number;
  end: number;
  status: 'booked' | 'cancelled' | 'time_passed' | 'completed';
  bookedAt: number;
  cancelledReason?: string;
}

export interface MessageSection {
  kind: 'clinician' | 'general' | 'notice';
  label: string;
  text: string;
  refId?: string;
}

export interface Message {
  id: string;
  key: string;
  caseId: string;
  from: 'coordinator' | 'patient';
  at: number;
  text: string;
  lead?: string; // opening line shown above sections
  sections?: MessageSection[];
  sectionsAfter?: boolean; // render sections below the main text
  sources?: { kbIds: string[]; noteIds: string[] };
  slotIds?: string[];
  tag?: string; // short label for admin views, e.g. "Explanation"
}

export type EventActor = 'coordinator' | 'patient' | 'practice' | 'reviewer';

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
    | 'schedule';
  title: string;
  why: string;
  refs?: { kbIds?: string[]; noteIds?: string[] };
}

export interface Handoff {
  id: string;
  caseId: string;
  at: number;
  routedTo: string;
  question: string;
  context: string[];
  status: 'shared' | 'discussion_booked' | 'discussed';
}

export interface Case {
  id: string;
  patientId: string;
  recommendationId: string;
  providerId: string;
  status: CaseStatus;
  stage: Stage;
  barrier: Barrier;
  appointmentId?: string; // active treatment appointment
  consultAppointmentId?: string; // active dentist discussion
  offeredSlotIds: string[];
  slotCursor: number; // used by "other times"
  pausedUntil?: number;
  nudgesSent: number;
  next?: Wake;
  lastAction?: { label: string; at: number };
  kbRefs: string[];
  noteRefs: string[];
  asked: string[];
  handoffId?: string;
  closedReason?: string;
  script: 'main' | 'scheduling' | 'clarify' | 'background';
}

export interface State {
  version: number;
  now: number;
  seq: number;
  providers: Record<string, Provider>;
  patients: Record<string, Patient>;
  recommendations: Record<string, Recommendation>;
  notes: Record<string, ClinicianNote>;
  kb: Record<string, KbEntry>;
  appointments: Record<string, Appointment>;
  bookedSlots: Record<string, string>; // slotId -> appointmentId
  blockedDays: Record<string, string>; // `${providerId}:${dayStart}` -> reason (provider unavailable)
  cases: Record<string, Case>;
  caseOrder: string[];
  messages: Message[];
  events: CaseEvent[];
  handoffs: Record<string, Handoff>;
  processedKeys: Record<string, number>;
  lastWake?: { caseId: string; wake: Wake };
}

export interface ReplyOption {
  id: string;
  label: string;
  group: 'primary' | 'slot' | 'more';
  hint?: string;
}
