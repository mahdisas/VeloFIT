/**
 * Sold packages & products report type (same row shape, different catalogs).
 * Real, RLS-scoped data + filter options are fetched in lib/reports/server.ts
 * (getSoldPackages / getSoldProducts / getSoldPackageOptions / getSoldProductOptions).
 */

export type SoldItem = {
  id: string;
  name: string;
  price: number;
  date: string;
  clientId: string;
  fullName: string;
  byUser: string;
};
