/**
 * New Classes Subscriptions report types. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (new subscriptions joined to clients + class_groups).
 */

export type NewSubscriptionRow = {
  id: string;
  clientId: string;
  fullName: string;
  phone: string;
  group: string;
  joiningDate: string; // yyyy-mm-dd
};
