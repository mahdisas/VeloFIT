/**
 * Staff Users types (Settings · Users). A user is a staff account (admin,
 * secretary, trainer …) with a permission set and an optional hourly rate.
 * Trainer-flagged users feed the trainer pickers across Classes/Calendar;
 * archived users move to Archive · Users. Real, RLS-scoped reads/writes live in
 * lib/settings/users-server.ts and app/(app)/settings/users/actions.ts.
 */

/** Permission flags, in display order (two-column grid in the drawer). */
export const PERMISSION_KEYS = [
  "classesManagement",
  "trainer",
  "secretary",
  "addUpdate",
  "delete",
  "memberApplication",
  "financeReports",
  "reports",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  classesManagement: "Classes management",
  trainer: "Trainer",
  secretary: "Secretary",
  addUpdate: "Add/update",
  delete: "Delete",
  memberApplication: "Member application",
  financeReports: "financereports",
  reports: "Reports",
};

export type Permissions = Record<PermissionKey, boolean>;

export type StaffUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  /** firstName + lastName, joined for the table. */
  fullName: string;
  phone: string;
  hourlyRate: number;
  permissions: Permissions;
};

export function emptyPermissions(): Permissions {
  return {
    classesManagement: false,
    trainer: false,
    secretary: false,
    addUpdate: false,
    delete: false,
    memberApplication: false,
    financeReports: false,
    reports: false,
  };
}

// getUsers() is a real, RLS-scoped query over profiles — see
// lib/settings/users-server.ts.
