/**
 * Inactive clients report types. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (clients with no active subscription).
 */

export type InactiveClientRow = {
  id: string;
  clientId: string;
  fullName: string;
  phone: string;
  age: number;
  gender: string;
  birthDate: string;
  lastSubscription: string;
  group: string;
  subscriptionType: string;
};
