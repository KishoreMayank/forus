import type { FaqFile, TreatmentKey } from './types';
import { at } from './time';

// What the practice offers, how long it takes, and which FAQ file explains it.
export interface Treatment {
  key: TreatmentKey;
  label: string; // "Crown"
  a: string; // "a crown"
  code: string; // treatment plan code as charted
  minutes: number;
  faq: string; // FAQ file id
}

export const TREATMENTS: Record<TreatmentKey, Treatment> = {
  crown: { key: 'crown', label: 'Crown', a: 'a crown', code: 'D2740 Crown', minutes: 90, faq: 'crowns' },
  filling: { key: 'filling', label: 'Filling', a: 'a filling', code: 'D2392 Composite', minutes: 45, faq: 'fillings' },
  root_canal: { key: 'root_canal', label: 'Root canal', a: 'a root canal', code: 'D3330 Root canal, molar', minutes: 90, faq: 'root-canals' },
  deep_cleaning: { key: 'deep_cleaning', label: 'Deep cleaning', a: 'a deep cleaning', code: 'D4341 Scaling & root planing', minutes: 90, faq: 'deep-cleaning' },
  implant: { key: 'implant', label: 'Implant', a: 'an implant', code: 'D6010 Implant', minutes: 120, faq: 'implants' },
  bridge: { key: 'bridge', label: 'Bridge', a: 'a bridge', code: 'D6240 Bridge', minutes: 120, faq: 'bridges' },
};

const why = (thing: string, a: string) => ({ key: 'why', q: `Why do I need ${thing}?`, a });
const alt = { key: 'alt', q: 'Could something else work instead?', route: 'dentist' as const };
const wait = { key: 'wait', q: 'What happens if I wait?', route: 'dentist' as const };

/** Practice-written FAQ files. Rendered as markdown; parsed by key when composing replies. */
export const FAQ_FILES: FaqFile[] = [
  {
    id: 'crowns', file: 'crowns.md', title: 'Crowns', editedBy: 'Office manager · reviewed by Dr. Shah', edited: at(2026, 9, 30),
    intro: 'General answers only. The reason a specific patient needs a crown always comes from their chart, never from this file.',
    entries: [
      why('a crown', 'A crown is a cap that covers the whole tooth, so biting pressure is spread evenly instead of landing on the weakened walls.'),
      { key: 'last', q: 'How long does a crown last?', a: 'Most last 10–15 years with normal brushing, flossing and check-ups.' },
      alt, wait,
    ],
  },
  {
    id: 'fillings', file: 'fillings.md', title: 'Fillings', editedBy: 'Dr. Shah', edited: at(2026, 9, 22),
    intro: 'General answers only.',
    entries: [
      why('a filling', 'A filling removes the decay and seals the tooth so the cavity doesn’t grow.'),
      { key: 'hurt', q: 'Will it hurt?', a: 'The area is numbed first. Most people feel pressure, not pain.' },
      wait,
    ],
  },
  {
    id: 'root-canals', file: 'root-canals.md', title: 'Root canals', editedBy: 'Dr. Bell', edited: at(2026, 9, 28),
    intro: 'General answers only. Why a patient needs one comes from their chart.',
    entries: [
      why('a root canal', 'A root canal removes the inflamed nerve and seals the tooth, so it can be kept instead of pulled.'),
      { key: 'hurt', q: 'Does it hurt?', a: 'It feels much like a filling. The tooth is numbed first, and most people are back to normal the next day.' },
      { key: 'alt', q: 'Can’t I just have it pulled?', route: 'dentist' },
    ],
  },
  {
    id: 'deep-cleaning', file: 'deep-cleaning.md', title: 'Deep cleaning', editedBy: 'Hygiene team', edited: at(2026, 10, 1),
    intro: 'Also called scaling and root planing.',
    entries: [
      why('a deep cleaning', 'A deep cleaning cleans below the gumline, where a regular cleaning can’t reach, so inflamed gums can heal.'),
      { key: 'alt', q: 'Why isn’t a regular cleaning enough?', route: 'dentist' },
    ],
  },
  {
    id: 'implants', file: 'implants.md', title: 'Implants', editedBy: 'Dr. Shah', edited: at(2026, 9, 18),
    intro: 'General answers only.',
    entries: [
      why('an implant', 'An implant replaces a missing tooth’s root, so a new tooth can sit there without relying on the teeth next to it.'),
      { key: 'last', q: 'How long does it take?', a: 'Usually a few months from placement to the final tooth, with short check-ins along the way.' },
      alt,
    ],
  },
  {
    id: 'bridges', file: 'bridges.md', title: 'Bridges', editedBy: 'Dr. Shah', edited: at(2026, 9, 18),
    intro: 'General answers only.',
    entries: [
      why('a bridge', 'A bridge fills the gap from a missing tooth by attaching a new tooth to the teeth on either side.'),
      alt,
    ],
  },
  {
    id: 'the-appointment', file: 'the-appointment.md', title: 'The appointment', editedBy: 'Dr. Bell', edited: at(2026, 10, 2),
    intro: 'What to expect on the day. Lengths come from scheduling.md.',
    entries: [
      { key: 'visit', q: 'What happens at the appointment?', a: 'The area is numbed, the work is done, and most people go back to normal activities the same day. Some soreness for a few days is common.' },
      { key: 'bring', q: 'What should I bring?', a: 'Your insurance card and a list of any medications.' },
    ],
  },
  {
    id: 'scheduling', file: 'scheduling.md', title: 'Scheduling', editedBy: 'Office manager', edited: at(2026, 9, 30),
    intro: 'Rules the follow-up uses when offering times.',
    entries: [
      { key: 'lengths', q: 'Appointment lengths', a: 'Crown, root canal, deep cleaning: 90 minutes · Filling: 45 minutes · Implant, bridge: 2 hours' },
      { key: 'rules', q: 'Rules', a: 'Book with the treating dentist · Offer times at least 24 hours out · Respect the patient’s preferred time of day' },
      { key: 'consult', q: 'Dentist discussion', a: '20 minutes, phone or in office, with the treating dentist only' },
    ],
  },
  {
    id: 'costs', file: 'costs.md', title: 'Costs & insurance', editedBy: 'Office manager', edited: at(2026, 10, 5), draft: true,
    intro: 'Draft. Only its routing rule is live: cost questions go to the front desk, who can see insurance and billing.',
    entries: [{ key: 'cost', q: 'How much will it cost?', route: 'front_desk' }],
  },
];
