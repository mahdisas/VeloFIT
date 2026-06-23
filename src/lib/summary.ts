/**
 * Summary data layer.
 *
 * The Summary page is a report/share-card builder: pick a period (a whole year
 * or a single month) and a language, tick which stats to include, and a
 * shareable "Celebrating Your Success" card renders from the result.
 *
 * `getSummary()` returns mock data today but documents the real Supabase
 * aggregates inline. It is period-aware so changing the year/month in the UI
 * produces different figures.
 *
 * Schema sources: clients, class_sessions, class_enrollments, class_kinds.
 */

export type SummaryPeriod = "year" | "month";
export type SummaryLanguage = "en" | "he" | "ar";

export const SUMMARY_LANGUAGES: { value: SummaryLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "he", label: "עברית" },
  { value: "ar", label: "العربية" },
];

/** Which stat rows the share card includes. Keys double as i18n anchors. */
export type SummaryToggles = {
  totalTrainees: boolean;
  totalLessons: boolean;
  mostRequestedClass: boolean;
  mostRegisteredTrainee: boolean;
};

export const DEFAULT_TOGGLES: SummaryToggles = {
  totalTrainees: true,
  totalLessons: true,
  mostRequestedClass: true,
  mostRegisteredTrainee: true,
};

export type SummaryParams = {
  period: SummaryPeriod;
  /** Four-digit year, e.g. 2026. */
  year: number;
  /** 1–12. Ignored when period === 'year'. */
  month: number;
  language: SummaryLanguage;
};

export type SummaryData = {
  totalTrainees: number;
  totalLessons: number;
  mostRequestedClass: string;
  mostRegisteredTrainee: string;
};

/** Selectable years for the "Select a year" dropdown. */
export function summaryYears(span = 6): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: span }, (_, i) => current - i);
}

/** "MM/YYYY" options for the "Select a month" dropdown (current month back). */
export function summaryMonths(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return { value: `${mm}/${d.getFullYear()}`, label: `${mm}/${d.getFullYear()}` };
  });
}

// getSummary() is a real, RLS-scoped aggregate — see lib/summary-server.ts.
