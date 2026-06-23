/**
 * Classes Absence Report types + filter options.
 *
 * Active subscribers who haven't entered the gym for longer than the selected
 * absence window. Real, RLS-scoped data is fetched in lib/reports/server.ts.
 */

export type AbsenceRow = {
  id: string;
  clientId: string;
  fullName: string;
  memberId: string;
  phone: string;
  group: string;
  startDate: string; // yyyy-mm-dd
  expireDate: string;
  lastEntrance: string | null; // yyyy-mm-dd, null = never entered
  durationMonths: number; // subscription plan length
};

export type AbsenceData = {
  rows: AbsenceRow[];
  groups: string[];
};

export const ABSENCE_PERIOD_OPTIONS = [3, 4, 5, 6, 7, 10, 14, 30].map((n) => ({
  value: String(n),
  label: `More than ${n} days`,
}));

// Subscription-length presets live in the shared module; re-exported for the
// absence component's existing import.
export { DURATION_PERIOD_OPTIONS } from "@/lib/reports/subscriptions";
