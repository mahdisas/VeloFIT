/**
 * Locations types (Settings · Locations). A location is a physical space inside
 * the gym (studio, main hall, outdoor …). Real, RLS-scoped reads/writes live in
 * lib/settings/locations-server.ts and app/(app)/settings/locations/actions.ts.
 */

export type Location = {
  id: string;
  name: string;
  description: string;
};
