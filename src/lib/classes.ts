/**
 * Classes types + client-safe constants (the "Classes Table" — recurring class
 * templates). Real, RLS-scoped reads/writes live in lib/classes-server.ts and
 * app/(app)/classes/class-actions.ts.
 */

export type IdName = { id: string; name: string };

/** A single "From → To" time pair, 24h "HH:MM" strings. */
export type TimeSlot = { from: string; to: string };

/** Weekly hours: 7 entries, index 0 = Sunday … 6 = Saturday. */
export type WeeklyHours = TimeSlot[][];

export type Equipment = { id: string; name: string; quantity: number };

export type ClassItem = {
  id: string;
  // ── Step 1 · Class Details ──────────────────────────────────────────────
  name: string;
  groupIds: string[];
  description: string;
  isFree: boolean;
  notifyTrainer: boolean;
  trainerId: string | null;
  hourlyRate: number;
  classKindId: string | null;
  location: string | null;
  color: string;
  // ── Step 2 · Class Settings ─────────────────────────────────────────────
  enrollBeforeHours: number;
  closeRegistrationHours: number;
  cancelBeforeHours: number | null;
  allowLateCancellation: boolean;
  waitingListByDefault: boolean;
  showEnrollList: boolean;
  showMaxParticipants: boolean;
  allowWaitingList: boolean;
  equipments: Equipment[];
  startDate: string | null; // "YYYY-MM-DD"
  expireDate: string | null;
  minParticipants: number;
  maxParticipants: number;
  cancelIfBelowMin: boolean;
  // ── Step 3 · Class Hours ────────────────────────────────────────────────
  weeklyHours: WeeklyHours;
  // ── meta ────────────────────────────────────────────────────────────────
  isActive: boolean;
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Day-of-week bridge between the UI's weekly grid and the DB.
 *   UI index:  0 = Sunday … 6 = Saturday  (matches DAY_NAMES + the hours editor)
 *   DB column: class_time_slots.day_of_week, ISO 1 = Monday … 7 = Sunday
 *              (matches Postgres extract(isodow …)).
 * Pure + client-safe so the server action and the reconstruct fetcher agree.
 */
export const uiDayToIsoDow = (ui: number): number => (ui === 0 ? 7 : ui);
export const isoDowToUiDay = (iso: number): number => (iso === 7 ? 0 : iso);

/** Palette offered by the Color picker (matches the veloFIT swatch grid). */
export const CLASS_COLORS = [
  "#ec1c79", "#3b82f6", "#f5b513", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#14b8a6",
  "#f0a8c4", "#c9a8d4", "#b6ecd2", "#f4b8a6", "#c3cdf2", "#b9a8e4",
];

export const emptyWeek = (): WeeklyHours => [[], [], [], [], [], [], []];
