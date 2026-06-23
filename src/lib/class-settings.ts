/**
 * Class Settings types. Per-gym rules governing class enrollment, reminders and
 * cancellations, stored in the gyms.settings jsonb under a `classes` key. Real
 * reads/writes live in lib/classes-server.ts (getClassSettings) and
 * app/(app)/classes/settings/actions.ts (saveClassSettings).
 */

export type ClassSettings = {
  convertWaitingToApproved: boolean;
  notifyOnCancellation: boolean;
  reminderMinutesBefore: number; // 0 disables reminders
  showClassesEveryWeek: boolean;
  scheduleNextDays: number;
  applyEnrollmentLimitAcrossSubscriptions: boolean;
  blockClientsForAbsences: boolean;
};

export const SCHEDULE_DAYS_OPTIONS = [7, 14, 30, 60, 90];

// Real reads/writes live in lib/classes-server.ts (getClassSettings) and
// app/(app)/classes/settings/actions.ts (saveClassSettings), backed by
// gyms.settings->'classes'.
