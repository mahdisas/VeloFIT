/**
 * Archived Users types (Archive · Users). Staff accounts that were archived
 * (soft-deleted) from Settings · Users; they keep their data and can be restored.
 * Real, RLS-scoped reads/writes live in lib/archive/archived-users-server.ts.
 */

export type ArchivedUser = {
  id: string;
  fullName: string;
  phone: string;
};

// getArchivedUsers() is a real, RLS-scoped query — see
// lib/archive/archived-users-server.ts.
