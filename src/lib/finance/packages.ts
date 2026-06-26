/**
 * Subscription Packages types (Finance · Subscription Packages). A package is a
 * sellable membership/billing plan: a price charged every N months for a number
 * of installments, optionally tied to one Subscription Group and flagged as a
 * trial lesson. Real, RLS-scoped reads/writes live in
 * lib/finance/packages-server.ts and app/(app)/finance/subscription-packages/actions.ts.
 */

export type SubscriptionPackage = {
  id: string;
  name: string;
  color: string;
  /** FK → class_groups.id (the "Subscription Group"); null = none. */
  groupId: string | null;
  /** Denormalised group label for the table — joined at read time. */
  groupName: string;
  price: number;
  /** 0 = unlimited. */
  maxPurchases: number;
  /** "Period In Month" — charge cadence. */
  periodMonths: number;
  /** Number of installments. */
  maximumPayments: number;
  isTrialLesson: boolean;
  showInApp: boolean;
  description: string;
  /** "Class pass / punch card" (כרטיסייה): consumed per class instead of per month. */
  isClassPlan: boolean;
  /** Number of classes the pass grants (null unless isClassPlan). */
  classesLimit: number | null;
  isActive: boolean;
};

// getPackages() and getGroupOptions() are real, RLS-scoped queries — see
// lib/finance/packages-server.ts.
