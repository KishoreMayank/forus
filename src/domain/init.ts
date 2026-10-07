import { seedState } from './seed';
import { tick } from './engine';
import type { State } from './types';

/** Fresh sample data with the clock started: due outreach goes out automatically. */
export function initialState(): State {
  const s = seedState();
  tick(s, s.now);
  return s;
}
