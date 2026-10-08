export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Local-time timestamp helper. Month is 1-based for readability. */
export function at(y: number, m: number, d: number, h = 0, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

/** Demo clock starts on Monday, Oct 12 2026 at 9:30 AM. */
export const DEMO_START = at(2026, 10, 12, 9, 30);

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function withTime(t: number, h: number, min = 0): number {
  const d = new Date(t);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function isWeekend(t: number): boolean {
  const day = new Date(t).getDay();
  return day === 0 || day === 6;
}

/** Contact window: weekdays 9:00–18:00. Returns t, or the next 10:00 AM weekday. */
export function nextContactTime(t: number): number {
  const d = new Date(t);
  const h = d.getHours() + d.getMinutes() / 60;
  if (!isWeekend(t) && h >= 9 && h < 18) return t;
  let cand = h >= 18 ? withTime(addDays(t, 1), 10) : withTime(t, 10);
  if (h < 9) cand = withTime(t, 10);
  while (isWeekend(cand)) cand = addDays(cand, 1);
  return cand;
}

/** Same weekday next week, at 10:00 (the "check back next week" rule). */
export function nextWeek(t: number): number {
  return nextContactTime(withTime(addDays(t, 7), 10));
}

const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDate = (t: number) => dateFmt.format(t);
export const fmtTime = (t: number) => timeFmt.format(t);
export const fmtShort = (t: number) => shortFmt.format(t);
export const fmtLong = (t: number) => longFmt.format(t);
export const fmtDateTime = (t: number) => `${dateFmt.format(t)}, ${timeFmt.format(t)}`;

/** Relative label vs. the simulated clock: "Today, 9:00 AM", "Tomorrow", "Wed, Oct 14". */
export function fmtRelative(t: number, now: number): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return `Today, ${fmtTime(t)}`;
  if (diff === 1) return `Tomorrow, ${fmtTime(t)}`;
  if (diff === -1) return `Yesterday, ${fmtTime(t)}`;
  return fmtDateTime(t);
}

export function fmtDayRelative(t: number, now: number): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return fmtDate(t);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "28 Sep" */
export const fmtDM = (t: number) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
/** "Thu 15 Oct" */
export const fmtWDM = (t: number) => { const d = new Date(t); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
/** "9:00" / "1:30" — 12-hour clock without AM/PM, as people write it in texts. */
export const fmtHM = (t: number) => { const d = new Date(t); const h = d.getHours() % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, '0')}`; };
