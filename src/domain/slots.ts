import type { Slot, State } from './types';
import { HOUR, MIN, addDays, at, isWeekend, startOfDay } from './time';

// Simulated practice schedule. Slots are generated deterministically so Reset
// always restores the same availability. A fixed share of slots are treated as
// already taken by other patients (outside this demo's records).

const PROVIDERS = ['shah', 'bell'] as const;
const CROWN_STARTS: [number, number][] = [[8, 0], [10, 0], [13, 30], [15, 30]];
const CONSULT_STARTS: [number, number][] = [[12, 0], [12, 30], [17, 0]];
export const CROWN_MINUTES = 90;
export const CONSULT_MINUTES = 20;
export const LEAD_TIME = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

function slotId(providerId: string, type: Slot['type'], t: number) {
  const d = new Date(t);
  return `${providerId}-${type}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

let cache: { all: Slot[]; byId: Record<string, Slot> } | null = null;

function build() {
  const all: Slot[] = [];
  const first = at(2026, 10, 12);
  for (let day = first; day < at(2027, 1, 31); day = addDays(day, 1)) {
    if (isWeekend(day)) continue;
    for (const p of PROVIDERS) {
      for (const [h, m] of CROWN_STARTS) {
        const start = new Date(day).setHours(h, m, 0, 0);
        all.push({ id: slotId(p, 'crown_prep', start), providerId: p, type: 'crown_prep', start, end: start + CROWN_MINUTES * MIN });
      }
      for (const [h, m] of CONSULT_STARTS) {
        const start = new Date(day).setHours(h, m, 0, 0);
        all.push({ id: slotId(p, 'consult', start), providerId: p, type: 'consult', start, end: start + CONSULT_MINUTES * MIN });
      }
    }
  }
  all.sort((a, b) => a.start - b.start);
  const byId: Record<string, Slot> = {};
  for (const s of all) byId[s.id] = s;
  return { all, byId };
}

function slots() {
  if (!cache) cache = build();
  return cache;
}

export function getSlot(id: string): Slot | undefined {
  return slots().byId[id];
}

/** Taken by patients outside this demo. Deterministic, roughly 60% of the book. */
export function takenElsewhere(id: string): boolean {
  return hash(id) % 10 < 6;
}

export const dayKey = (providerId: string, t: number) => `${providerId}:${startOfDay(t)}`;

export function isBookable(state: State, slot: Slot): boolean {
  return (
    slot.start >= state.now + LEAD_TIME &&
    !state.bookedSlots[slot.id] &&
    !takenElsewhere(slot.id) &&
    !state.blockedDays[dayKey(slot.providerId, slot.start)]
  );
}

export function matchesPreference(slot: Slot, pref: 'morning' | 'afternoon' | 'any'): boolean {
  const h = new Date(slot.start).getHours();
  if (pref === 'morning') return h < 12;
  if (pref === 'afternoon') return h >= 12;
  return true;
}

/** Next `count` valid slots for a provider/type, optionally after a time and honoring a preference. */
export function findSlots(
  state: State,
  opts: { providerId: string; type: Slot['type']; pref?: 'morning' | 'afternoon' | 'any'; after?: number; count?: number },
): Slot[] {
  const { providerId, type, pref = 'any', after = 0, count = 3 } = opts;
  const out: Slot[] = [];
  const usedDays = new Set<number>();
  for (const s of slots().all) {
    if (s.providerId !== providerId || s.type !== type) continue;
    if (s.start <= after) continue;
    if (!isBookable(state, s) || !matchesPreference(s, pref)) continue;
    // Spread options across different days so the choice is meaningful.
    const day = startOfDay(s.start);
    if (usedDays.has(day)) continue;
    usedDays.add(day);
    out.push(s);
    if (out.length >= count) break;
  }
  return out;
}
