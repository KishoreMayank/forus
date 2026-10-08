import { apply, replyOptions, tick } from './engine';
import { seedState } from './seed';
import { getSlot } from './slots';
import { DEMO_START, at } from './time';
import type { State } from './types';

type Step = [number, string, string | { slotOnOrAfter: number; prefix?: string }];

// Each patient's history so far, as replies made at specific times. The engine produces
// every message, booking, follow-up and pause from these, exactly as it would live.
const HISTORY: Step[] = [
  [at(2026, 10, 1, 14, 0), 'aisha', 'pause_month'],
  [at(2026, 10, 5, 18, 2), 'elena', 'why'],
  [at(2026, 10, 6, 10, 55), 'robert', 'visit'],
  [at(2026, 10, 6, 10, 58), 'robert', 'book'],
  [at(2026, 10, 6, 11, 0), 'robert', { slotOnOrAfter: at(2026, 10, 15) }],
  [at(2026, 10, 8, 9, 38), 'elena', 'q:alt'],
  [at(2026, 10, 8, 9, 41), 'elena', 'consult_yes'],
  [at(2026, 10, 8, 9, 42), 'elena', { slotOnOrAfter: at(2026, 10, 22), prefix: 'consult_slot:' }],
  [at(2026, 10, 9, 11, 0), 'hana', 'why'],
  [at(2026, 10, 9, 11, 5), 'hana', 'book'],
  [at(2026, 10, 9, 11, 6), 'hana', { slotOnOrAfter: at(2026, 10, 20) }],
  [at(2026, 10, 9, 12, 15), 'daniel', 'visit'],
  [at(2026, 10, 9, 12, 20), 'daniel', 'book'],
  [at(2026, 10, 12, 8, 24), 'omar', 'cost'],
  [at(2026, 10, 12, 8, 40), 'sam', 'book'],
  [at(2026, 10, 12, 8, 42), 'sam', { slotOnOrAfter: at(2026, 10, 16) }],
  [at(2026, 10, 12, 9, 12), 'maya', 'why'],
  [at(2026, 10, 12, 9, 16), 'maya', 'q:last'],
  [at(2026, 10, 12, 9, 20), 'maya', 'book'],
];

/** Pick the first offered time on or after a date, asking for more times if needed. */
function pickSlot(s: State, caseId: string, after: number, prefix = 'slot:') {
  for (let i = 0; i < 8; i++) {
    const opts = replyOptions(s, caseId).filter((o) => o.id.startsWith(prefix));
    const hit = opts.find((o) => getSlot(o.id.slice(prefix.length))!.start >= after);
    if (hit) return apply(s, { type: 'reply', caseId, optionId: hit.id });
    apply(s, { type: 'reply', caseId, optionId: prefix === 'slot:' ? 'more_times' : 'more_consult_times' });
  }
  throw new Error(`No slot found for ${caseId}`);
}

/** Sample practice at Mon 12 Oct, 9:30 AM, with every history played through the engine. */
export function initialState(): State {
  const s = seedState();
  for (const [when, caseId, what] of HISTORY) {
    tick(s, when);
    s.now = Math.max(s.now, when);
    if (typeof what === 'string') apply(s, { type: 'reply', caseId, optionId: what });
    else pickSlot(s, caseId, what.slotOnOrAfter, what.prefix);
  }
  tick(s, DEMO_START);
  s.now = DEMO_START;
  s.lastSync = DEMO_START - 26 * 60_000; // 9:04, the morning sync that found Nora and Leo
  return s;
}
