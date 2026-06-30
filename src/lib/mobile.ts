/**
 * Client-safe helpers for the veloFIT mobile app (no DB imports). The real,
 * gym-scoped reads live in lib/mobile-server.ts; the screen pages thread the
 * results into the client components below.
 */
import { toISO, type CalendarSession, type CalendarSessionMap } from "@/lib/calendar";

/** A class occurrence with its calendar date attached (the map drops the date). */
export type DatedSession = CalendarSession & { date: string };

/** Flatten the date→sessions map to a single time-sorted list (cancelled dropped). */
export function flattenSessions(map: CalendarSessionMap): DatedSession[] {
  const out: DatedSession[] = [];
  for (const [date, list] of Object.entries(map ?? {})) {
    for (const s of list) if (!s.canceled) out.push({ ...s, date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
}

/** "HH:MM" for a Date (local). */
export function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Items that haven't ended yet, relative to the client's local clock. Generic
 * over anything with a `date` ("YYYY-MM-DD") and `to` ("HH:MM") — works for both
 * calendar sessions and the member's own enrolled classes.
 */
export function upcomingFrom<T extends { date: string; to: string }>(items: T[], now = new Date()): T[] {
  const today = toISO(now);
  const time = hhmm(now);
  return items.filter((s) => s.date > today || (s.date === today && s.to >= time));
}

/** Sessions already finished, newest first (for History). */
export function pastFrom(sessions: DatedSession[], now = new Date()): DatedSession[] {
  const today = toISO(now);
  const time = hhmm(now);
  return sessions
    .filter((s) => s.date < today || (s.date === today && s.to < time))
    .sort((a, b) => b.date.localeCompare(a.date) || b.from.localeCompare(a.from));
}

/** Time-of-day greeting key (translate with t()). */
export function greetingKey(now = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** First token of a full name, for a friendly greeting. */
export function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * A guaranteed-vibrant hex for a class logo block: keeps the class's own color
 * unless it's missing/invalid or too light for a white icon (which would render
 * as a grey placeholder), in which case it falls back to the brand color.
 */
export function vibrantColor(hex: string | null | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return "#ec1c79";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.72 ? "#ec1c79" : `#${m[1].toLowerCase()}`;
}

export type { CalendarSession };
