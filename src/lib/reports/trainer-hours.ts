/**
 * Trainer Hours report types + Studio Summary aggregation. Real, RLS-scoped data
 * is fetched in lib/reports/server.ts (class sessions a trainer ran, joined to
 * enrollments + the class hourly rate).
 */

export type TrainerHourRow = {
  id: string;
  className: string;
  date: string; // yyyy-mm-dd
  weekday: string;
  fromHour: string;
  toHour: string;
  enrollments: number;
  duration: number; // hours
  classRate: number;
  canceled: boolean;
};

export type TrainerSummaryRow = {
  className: string;
  totalClasses: number;
  totalHours: number;
  totalSumHourly: number;
  totalSumClass: number;
};

/** Aggregate detail rows into the Studio Summary (grouped by class). */
export function summarizeTrainerHours(rows: TrainerHourRow[]): TrainerSummaryRow[] {
  const map = new Map<string, TrainerSummaryRow>();
  for (const r of rows) {
    const cur = map.get(r.className) ?? { className: r.className, totalClasses: 0, totalHours: 0, totalSumHourly: 0, totalSumClass: 0 };
    cur.totalClasses += 1;
    cur.totalHours += r.duration;
    cur.totalSumHourly += r.duration * r.classRate;
    cur.totalSumClass += r.classRate;
    map.set(r.className, cur);
  }
  return [...map.values()];
}
