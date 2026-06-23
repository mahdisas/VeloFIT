/** Shared formatting helpers for report tables. Dates delegate to the app-wide
 * DD/MM/YYYY formatters (date-fns) in lib/format. */
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const fmtDate = (iso: string): string => formatDate(iso);
export const fmtDateTime = (iso: string): string => formatDateTime(iso);
export const money = formatMoney;

/** First letters of the first two name words, e.g. "אדם כשאן" → "א כ". */
export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] ?? ""} ${p[1]?.[0] ?? ""}`.trim();
}

/** Age (years) at 16 Jun 2026 from a yyyy-mm-dd birth date. */
export function ageFrom(birth: string | null): number {
  if (!birth) return 0;
  const b = new Date(birth);
  const now = new Date(2026, 5, 16);
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a -= 1;
  return a;
}
