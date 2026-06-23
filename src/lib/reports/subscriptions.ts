/**
 * Shared subscription-report types, filter options and helpers.
 *
 * Several reports (Classes Main, Classes Expire, …) are the same subscription
 * rows behind different filter bars, so the row shape, options and status meta
 * live here once. The real, RLS-scoped data is fetched in lib/reports/server.ts.
 */

import { type Gender } from "@/lib/clients";

export type { Gender };
export type SubscriptionStatus = "active" | "inactive" | "cancelled" | "future";

export type SubscriptionRow = {
  id: string;
  clientId: string; // links to /clients/<id>
  fullName: string;
  memberId: string; // the "ID" column
  phone: string;
  group: string;
  status: SubscriptionStatus;
  startDate: string; // yyyy-mm-dd
  expireDate: string;
  cost: number;
  gender: Gender;
  isRenewal: boolean; // false = original subscription, true = a renewal
  // Optional — only the Subscriptions Balance report populates these.
  classesEnrolled?: number;
  maxEnrollments?: number | null; // null = unlimited (shown as "—")
  // Optional — only the Direct Debit report populates these.
  succeedPayments?: number;
  totalPayments?: number;
  isMonthly?: boolean; // a monthly-renewal direct-debit subscription
};

export type SubscriptionsData = {
  rows: SubscriptionRow[];
  groups: string[];
};

export const SUBSCRIPTION_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active Subscriptions" },
  { value: "inactive", label: "InActive Subscriptions" },
  { value: "future", label: "Future Subscriptions" },
  { value: "cancelled", label: "Cancelled Subscription" },
];

export const GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Which date the From/To range filters on (shared by Expire + Renewal reports). */
export const SUBSCRIBERS_WHO_OPTIONS = [
  { value: "start", label: "Start date between the dates" },
  { value: "end", label: "End date between the dates" },
];

export const PERIOD_OPTIONS = [
  { value: "all", label: "Select a period" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
];

/** Subscription-length presets, for reports that filter on plan duration. */
export const DURATION_PERIOD_OPTIONS = [
  { value: "all", label: "Select a period" },
  { value: "1", label: "1 Month" },
  { value: "2", label: "2 Months" },
  { value: "3", label: "3 Months" },
  { value: "4", label: "4 Months" },
  { value: "5", label: "5 Months" },
  { value: "6", label: "6 Months" },
  { value: "12", label: "12 Months - annual" },
];

/** Whole months between two yyyy-mm-dd dates (subscription plan length). */
export function monthsBetween(start: string, expire: string): number {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = expire.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return months;
}

export const STATUS_META: Record<SubscriptionStatus, { label: string; tone: "green" | "rose" | "red" | "blue" }> = {
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "red" },
  future: { label: "Future", tone: "blue" },
};

/** [from, to] yyyy-mm-dd bounds for a period preset, relative to today. */
export function periodRange(period: string): [string, string] | null {
  if (period === "all" || !period) return null;
  const now = new Date();
  const y = now.getFullYear();
  const iso = (yr: number, mo: number, da: number) =>
    `${yr}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  switch (period) {
    case "this-month": return [iso(y, now.getMonth() + 1, 1), iso(y, now.getMonth() + 1, 31)];
    case "last-month": {
      const lm = new Date(y, now.getMonth() - 1, 1);
      return [iso(lm.getFullYear(), lm.getMonth() + 1, 1), iso(lm.getFullYear(), lm.getMonth() + 1, 31)];
    }
    case "this-year": return [iso(y, 1, 1), iso(y, 12, 31)];
    case "last-year": return [iso(y - 1, 1, 1), iso(y - 1, 12, 31)];
    default: return null;
  }
}
