/**
 * Calendar data layer — pure types, date math, and client-side filtering for the
 * scheduling grid.
 *
 * A "session" is one occurrence of a class on a given day (public.class_sessions).
 * The real, gym-scoped reads live in lib/classes-server.ts (getCalendarSessions /
 * getCalendarPageData), fetched server-side and threaded to the grid through
 * components/classes/calendar/calendar-sessions-context.tsx. This module stays
 * client-safe (no DB imports) so the grid components can import its types/helpers.
 *
 * NOTE: the grid is Monday-first; JS getDay() is Sunday-first (0=Sun…6=Sat).
 */

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarSession = {
  id: string;
  classId: string;
  name: string;
  trainer: string;
  trainerId: string | null; // effective trainer (session substitute ?? class default)
  locationId: string | null; // from the parent class
  color: string;
  from: string; // "HH:MM"
  to: string; // "HH:MM"
  enrolled: number;
  capacity: number;
  kindId: string;
  canceled: boolean;
  notes: string; // per-session note (interim store: gyms.settings.sessionNotes[id])
};

/** Sessions keyed by local ISO date ("YYYY-MM-DD") — what the grid looks up per day. */
export type CalendarSessionMap = Record<string, CalendarSession[]>;

export function filterSessions(
  list: CalendarSession[],
  kindIds: string[] | "all",
  showCanceled: boolean
): CalendarSession[] {
  return list.filter(
    (x) => (kindIds === "all" || kindIds.includes(x.kindId)) && (showCanceled || !x.canceled)
  );
}

/* ── date helpers (no external deps) ───────────────────────────────────────── */

export const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const LONG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function monthYearLabel(d: Date): string {
  return `${MONTHS[d.getMonth()]} - ${d.getFullYear()}`;
}

/** Index within a Monday-first week (Mon = 0 … Sun = 6). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The Monday on/before the given date. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -mondayIndex(d));
}

/** The 7 dates of the Monday-first week containing `d`. */
export function weekDates(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * The full month grid as Monday-first weeks. Spans from the Monday on/before
 * the 1st to the Sunday on/after the last day, so every cell exists (no
 * "missing 30th" gap) and adjacent-month days fill the edges.
 */
export function monthGridWeeks(d: Date): Date[][] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6); // Sunday of the last week
  const weeks: Date[][] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
  }
  return weeks;
}

/**
 * The visible [start, end] local-date window for a view + cursor — used to fetch
 * exactly the sessions the grid will render. Matches each view's own date math:
 * month spans the full Monday-first grid, week/agenda the 7-day week, day a single day.
 */
export function visibleRange(view: CalendarView, cursor: Date): { start: string; end: string } {
  if (view === "month") {
    const weeks = monthGridWeeks(cursor);
    return { start: toISO(weeks[0][0]), end: toISO(weeks[weeks.length - 1][6]) };
  }
  if (view === "day") return { start: toISO(cursor), end: toISO(cursor) };
  const wd = weekDates(cursor); // week & agenda
  return { start: toISO(wd[0]), end: toISO(wd[6]) };
}

/** Minutes since midnight for "HH:MM". */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** "HH:MM" + 60 minutes, clamped to 23:59. For the smart time picker. */
export function addOneHour(time: string): string {
  if (!time) return "";
  const total = Math.min(23 * 60 + 59, toMinutes(time) + 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "DD/MM/YYYY". */
export function slashDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2 June 2026". */
export function longDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
