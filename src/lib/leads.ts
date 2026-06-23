/**
 * Leads types. A lead is a prospective member captured before they convert to a
 * client. Real, RLS-scoped reads/writes live in lib/leads-server.ts and
 * app/(app)/leads/actions.ts (converting a lead inserts a clients row).
 */

import { ageFromBirthDate, type Gender, initials } from "@/lib/clients";

export { ageFromBirthDate, initials };

export type LeadStatus = "new" | "contacted" | "converted" | "lost";

export type LeadListRow = {
  id: string;
  fullName: string;
  nationalId: string;
  birthDate: string | null; // ISO; age is derived
  phone: string;
  gender: Gender;
  avatarUrl: string | null;
  blocked: boolean;
  status: LeadStatus;
};

// getLeads() is a real, RLS-scoped query — see lib/leads-server.ts.
