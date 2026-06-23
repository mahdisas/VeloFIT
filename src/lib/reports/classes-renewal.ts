/**
 * Classes Renewal Report filter options. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (getRenewalRows).
 */

export const RENEWAL_STATUS_OPTIONS = [
  { value: "non-renewal", label: "Active clients - with non renewal subscriptions" },
  { value: "renewal", label: "Active clients - with renewal subscriptions" },
];
