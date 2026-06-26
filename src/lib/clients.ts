/**
 * Clients types + pure, client-safe helpers. Real, RLS-scoped reads/writes live
 * in lib/clients-server.ts and app/(app)/clients/client-actions.ts. The New
 * Client form collects first/middle/last separately and composes them into
 * clients.full_name.
 */

export type Gender = "male" | "female" | "other";

// -----------------------------------------------------------------------------
// List
// -----------------------------------------------------------------------------
export type ClientListRow = {
  id: string;
  number: number; // client_number — leading column in the list
  fullName: string;
  nationalId: string;
  birthDate: string | null; // ISO; age is derived
  phone: string;
  gender: Gender;
  avatarUrl: string | null;
};

/** Age in whole years from an ISO birth date, or null. */
export function ageFromBirthDate(iso: string | null): number | null {
  if (!iso) return null;
  const birth = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

/** Two-letter initials for the avatar fallback (keeps RTL order intact). */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("");
}

/**
 * Shape returned by the clients-list query (snake_case DB columns). Exported so
 * the server data layer (clients-server.ts) shares one source of truth.
 */
export type ClientListDbRow = {
  id: string;
  client_number: number | null;
  full_name: string;
  national_id: string | null;
  birth_date: string | null;
  phone: string | null;
  gender: Gender | null;
  avatar_url: string | null;
};

export const CLIENT_LIST_COLUMNS =
  "id, client_number, full_name, national_id, birth_date, phone, gender, avatar_url";

/**
 * Map a DB row to the UI's ClientListRow. Pure (client-safe) — shared by the
 * list page, archive + global search.
 */
export function mapClientRow(r: ClientListDbRow): ClientListRow {
  return {
    id: r.id,
    number: r.client_number ?? 0,
    fullName: r.full_name,
    nationalId: r.national_id ?? "",
    birthDate: r.birth_date,
    phone: r.phone ?? "",
    gender: r.gender ?? "other",
    avatarUrl: r.avatar_url,
  };
}

// -----------------------------------------------------------------------------
// Profile (header card)
// -----------------------------------------------------------------------------
export type ClientProfile = {
  id: string;
  fullName: string;
  age: number | null;
  phone: string;
  balance: number;
  lastEntrance: string | null; // ISO datetime
  avatarUrl: string | null;
};

// getClient() lives in the server-only data layer — see lib/clients-server.ts.

/** A linked family member (another client in the same gym). */
export type FamilyMember = {
  id: string;
  fullName: string;
  clientNumber: number;
  phone: string;
  birthDate: string | null;
};

/** Full editable record for the Edit Client form (pre-fill). Client-safe type. */
export type ClientEditData = {
  fullName: string;
  phone: string;
  phone2: string;
  email: string;
  nationalId: string;
  gender: "male" | "female" | "other" | "";
  birthDate: string;
  city: string;
  address: string;
  notes: string;
  messagingOpt: boolean;
};

// -----------------------------------------------------------------------------
// Profile tabs
// -----------------------------------------------------------------------------
export type SubscriptionStatus = "active" | "inactive" | "frozen" | "expired";

/**
 * Per-subscription enrollment caps + cancellation balance + auto-enroll flag.
 * The subscriptions table has no columns for these, so they live in the interim
 * gyms.settings->'subscriptionLimits' JSON store keyed by subscription id.
 */
export type SubscriptionLimits = {
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  maxTotal: number;
  cancellationBalance: number;
  autoEnroll: boolean;
};

export const DEFAULT_SUBSCRIPTION_LIMITS: SubscriptionLimits = {
  maxPerDay: 0,
  maxPerWeek: 0,
  maxPerMonth: 0,
  maxTotal: 0,
  cancellationBalance: 0,
  autoEnroll: false,
};

export type ClientSubscription = {
  id: string;
  status: SubscriptionStatus;
  group: string;
  fromDate: string; // ISO
  toDate: string; // ISO
  balance: number | null;
  planId: string; // for edit / re-purchase
  cost: number; // price_paid
  notes: string;
  limits: SubscriptionLimits;
  // Class pass / punch card tracking (null/0 unless the plan is a class pass).
  isClassPlan: boolean;
  classesLimit: number | null;
  classesUsed: number;
};

// getClientSubscriptions() is now a real query — see lib/clients-server.ts.

/**
 * Class passes (כרטיסייה) can be endless on time — "punch until used up". The DB
 * `subscriptions.end_date` is NOT NULL, so a no-expiry pass stores a far-future
 * sentinel instead; the UI shows "No Expiration" and effective_status never reads
 * it as date-expired. Detection is "year ≥ 9000" so it survives reformatting.
 */
export const NO_EXPIRY_DATE = "9999-12-31";
export function isNoExpiry(iso: string | null | undefined): boolean {
  return !!iso && iso >= "9000-01-01";
}

/**
 * One purchasable plan for the New-Subscription "Group" picker. A subscription
 * must reference a subscription_plan (FK), so the dropdown lists the gym's real
 * packages; the displayed text is the plan's class group (falling back to the
 * plan name) to match the reference's "Group" column.
 */
export type SubscriptionPlanOption = {
  id: string;
  label: string; // group name (fallback: plan name)
  planName: string;
  price: number;
  periodMonths: number;
  // Class pass / punch card: a class plan defaults to no expiry on purchase.
  isClassPlan: boolean;
  classesLimit: number | null;
};

export type AccountingInvoiceType =
  | "receipt_tax_invoice"
  | "tax_invoice"
  | "refund_invoice"
  | "receipt"
  | "informal"
  | "bid"
  | "non_formal_transaction";

export const INVOICE_TYPES: { value: AccountingInvoiceType; label: string }[] = [
  { value: "receipt_tax_invoice", label: "Receipt tax invoice" },
  { value: "tax_invoice", label: "Tax invoice" },
  { value: "refund_invoice", label: "Refund invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "informal", label: "Informal" },
  { value: "bid", label: "Bid" },
  { value: "non_formal_transaction", label: "Non Formal Transaction" },
];

/** DB doc_type values that represent a billable charge — they count toward the
 *  client balance and can receive a "Log Payment" (Receipt) against them. */
export const INVOICE_DOC_TYPES = ["tax_invoice", "receipt_tax_invoice", "receipt", "informal"];

export type AccountingDocument = {
  id: string;
  date: string; // ISO
  invoiceNo: string;
  docType: string; // raw DB doc_type enum (for charge / payable checks)
  type: string; // translated display label
  vat: number; // VAT portion of the amount (0 for non-VAT document types)
  amount: number; // gross total (VAT-inclusive)
  paid: number; // Σ payments linked to this document (payments.document_id)
};

// getClientAccounting() is now a real query — see lib/clients-server.ts.

/**
 * Measurements are long-format: the gym configures the fields in
 * Settings · Measurement Types (`measurement_types`), and each reading stores a
 * value per type. The Fitness tab renders one column per active type, so the
 * columns always match Settings.
 */
export type MeasurementType = {
  id: string;
  name: string;
  unit: string | null;
};

export type MeasurementEntry = {
  id: string;
  date: string; // ISO
  values: Record<string, number>; // measurement_type_id → value
};

/** Column header for a measurement type: "Weight (Kg)" / "BMI". */
export function measurementColumnLabel(t: MeasurementType): string {
  return t.unit ? `${t.name} (${t.unit})` : t.name;
}

// getClientMeasurements() / getMeasurementTypes() are real queries — see lib/clients-server.ts.

export type ClientFile = { id: string; fileName: string; date: string };
export async function getClientFiles(clientId: string): Promise<ClientFile[]> {
  // From a `client_files` table backed by Supabase Storage (TBD).
  void clientId;
  return [];
}

export type ClientTask = {
  id: string;
  date: string;
  title: string;
  status: string;
  blockingEntry: boolean;
  reminderDate: string | null;
};
// getClientTasks() is now a real query — see lib/clients-server.ts.

export type Communication = {
  id: string;
  date: string; // ISO datetime
  type: string;
  content: string;
};
// getClientCommunications() is now a real query — see lib/clients-server.ts.

export type ActivityLog = {
  id: string;
  date: string; // ISO datetime
  action: "Create" | "Update" | "Delete";
  item: string;
  name: string;
  initiatedBy: string;
};

// getClientActivityLogs() is now a real query — see lib/clients-server.ts.

export type ClassHistoryEntry = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  startTime: string; // "20:00"
  endTime: string; // "21:00"
  className: string;
  checkedIn: boolean;
  hasNotes: boolean;
  notes: string;
};
// getClientClassHistory() is now a real query — see lib/clients-server.ts.
