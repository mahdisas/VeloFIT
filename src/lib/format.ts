/**
 * App-wide display formatters. Client-safe (no server imports) so any component
 * can use them. Dates render strictly as DD/MM/YYYY via date-fns.
 */
import { format, isValid, parseISO } from "date-fns";

/** Any ISO date / datetime string → "DD/MM/YYYY". Null / invalid → `fallback`. */
export function formatDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = parseISO(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : fallback;
}

/** ISO datetime → "DD/MM/YYYY HH:mm". Null / invalid → `fallback`. */
export function formatDateTime(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = parseISO(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : fallback;
}

/** ₪ currency, two decimals. */
export function formatMoney(n: number): string {
  return `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
