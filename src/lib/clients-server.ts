import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  ageFromBirthDate,
  mapClientRow,
  CLIENT_LIST_COLUMNS,
  INVOICE_DOC_TYPES,
  type AccountingDocument,
  type ActivityLog,
  type ClassHistoryEntry,
  type ClientEditData,
  type ClientListDbRow,
  type ClientListRow,
  type ClientProfile,
  type ClientSubscription,
  type SubscriptionLimits,
  DEFAULT_SUBSCRIPTION_LIMITS,
  type ClientTask,
  type Communication,
  type FamilyMember,
  type MeasurementEntry,
  type MeasurementType,
  type SubscriptionPlanOption,
  type SubscriptionStatus,
} from "@/lib/clients";

/** The cookie-scoped server client returned by getAuthedProfile(). */
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Server-only client data access. Kept separate from lib/clients.ts (which holds
 * client-safe types + pure helpers) so importing a type into a Client Component
 * never pulls the cookie-scoped Supabase server client into the browser bundle.
 *
 * Every query runs through the cookie-scoped server client, so RLS restricts
 * rows to the signed-in staff member's gym automatically.
 */

/** Active (non-archived) clients for the signed-in gym. */
export async function getClients(): Promise<ClientListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_LIST_COLUMNS)
    .neq("status", "archived")
    .order("client_number", { ascending: false }); // newest-added first (stack order)

  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return ((data ?? []) as ClientListDbRow[]).map(mapClientRow);
}

/** Archived clients for the signed-in gym (Archive · Clients). */
export async function getArchivedClients(): Promise<ClientListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_LIST_COLUMNS)
    .eq("status", "archived")
    .order("client_number", { ascending: false }); // newest-added first (stack order)

  if (error) throw new Error(`Failed to load archived clients: ${error.message}`);
  return ((data ?? []) as ClientListDbRow[]).map(mapClientRow);
}

/**
 * Document types that represent a charge to the client, summed for balance.
 * Must include every payment-bearing type (see DOC_HAS_PAYMENT in client-actions)
 * — otherwise recording a payment on it would push the balance negative.
 * "informal" carries a payment, so it counts as a charge.
 * (INVOICE_DOC_TYPES is the single source of truth in lib/clients.ts.)
 */

/**
 * A client's outstanding balance = Σ invoiced documents − Σ payments, tenant-scoped.
 * Positive = the client owes money; ≤ 0 = settled. Mirrors the Finance Charges
 * report so the profile and the report agree.
 */
export async function getClientBalance(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<number> {
  const [docsRes, payRes] = await Promise.all([
    supabase.from("accounting_documents").select("doc_type, total").eq("gym_id", gymId).eq("client_id", clientId),
    supabase.from("payments").select("amount").eq("gym_id", gymId).eq("client_id", clientId),
  ]);
  if (docsRes.error) throw new Error(`Failed to load documents: ${docsRes.error.message}`);
  if (payRes.error) throw new Error(`Failed to load payments: ${payRes.error.message}`);

  const invoiced = ((docsRes.data ?? []) as { doc_type: string; total: number }[])
    .filter((d) => INVOICE_DOC_TYPES.includes(d.doc_type))
    .reduce((sum, d) => sum + Number(d.total), 0);
  const paid = ((payRes.data ?? []) as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.round((invoiced - paid) * 100) / 100;
}

/** Single client for the profile header. */
export async function getClient(id: string): Promise<ClientProfile | null> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone, birth_date, avatar_url")
    .eq("gym_id", profile.gymId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!data) return null;
  const c = data as {
    id: string;
    full_name: string;
    phone: string | null;
    birth_date: string | null;
    avatar_url: string | null;
  };

  // Most recent door check-in → the header's "last entrance".
  const { data: lastEntry } = await supabase
    .from("attendances")
    .select("checked_in_at")
    .eq("client_id", id)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: c.id,
    fullName: c.full_name,
    age: ageFromBirthDate(c.birth_date),
    phone: c.phone ?? "",
    balance: await getClientBalance(supabase, profile.gymId, id),
    lastEntrance: (lastEntry as { checked_in_at: string } | null)?.checked_in_at ?? null,
    avatarUrl: c.avatar_url,
  };
}

// =============================================================================
// Client profile tabs — real, tenant-scoped reads.
//
// Each takes the authed `supabase` client + `gymId` from getAuthedProfile() so
// the query is doubly scoped: RLS restricts rows to the gym, and the explicit
// gym_id + client_id filters make the intent clear. Throw on DB error so the
// route's error.tsx boundary can render a graceful fallback; an empty result is
// a normal empty state (handled by the tab UI), not an error.
// =============================================================================

/** Date-aware status (mirrors the SQL effective_status function). */
function effectiveStatus(status: string, start: string, end: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (status === "active" && end < today) return "expired";
  if (status === "active" && start > today) return "pending";
  return status;
}

/** Map a DB subscription status to the badge's UI union. */
function toUiStatus(s: string): SubscriptionStatus {
  return s === "active" || s === "frozen" || s === "expired" ? s : "inactive";
}

/** Subscriptions → plan → class group (the displayed "Group"). */
export async function getClientSubscriptions(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<ClientSubscription[]> {
  const [subsRes, payRes, gymRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, plan_id, start_date, end_date, status, price_paid, classes_used, notes, plan:subscription_plans(name, is_class_plan, classes_limit, group:class_groups(name))"
      )
      .eq("gym_id", gymId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }), // newest-added first (stack order)
    supabase
      .from("payments")
      .select("subscription_id, amount")
      .eq("gym_id", gymId)
      .eq("client_id", clientId)
      .not("subscription_id", "is", null),
    // Per-subscription enrollment caps live in the interim gyms.settings store.
    supabase.from("gyms").select("settings").eq("id", gymId).maybeSingle(),
  ]);

  if (subsRes.error) throw new Error(`Failed to load subscriptions: ${subsRes.error.message}`);
  if (payRes.error) throw new Error(`Failed to load payments: ${payRes.error.message}`);

  // Σ payments per subscription → owed = cost − paid.
  const paidBySub = new Map<string, number>();
  for (const p of (payRes.data ?? []) as { subscription_id: string; amount: number }[]) {
    paidBySub.set(p.subscription_id, (paidBySub.get(p.subscription_id) ?? 0) + Number(p.amount));
  }

  const limitsById =
    ((gymRes.data?.settings as { subscriptionLimits?: Record<string, Partial<SubscriptionLimits>> } | null)
      ?.subscriptionLimits ?? {});

  return ((subsRes.data ?? []) as unknown as SubscriptionRow[]).map((r) => {
    const cost = Number(r.price_paid ?? 0);
    const paid = paidBySub.get(r.id) ?? 0;
    const isClassPlan = r.plan?.is_class_plan ?? false;
    const classesLimit = r.plan?.classes_limit ?? null;
    const classesUsed = Number(r.classes_used ?? 0);
    // Strict punch-card limit: a class pass that has used all its credits is
    // "completed" — it stops reading as active (the owner's cue to renew). Time
    // never expires it (see NO_EXPIRY_DATE); only the credit count or the date do.
    let eff = effectiveStatus(r.status, r.start_date, r.end_date);
    if (eff === "active" && isClassPlan && classesLimit != null && classesUsed >= classesLimit) {
      eff = "completed"; // not in {active,frozen,expired} → toUiStatus maps to "inactive"
    }
    return {
      id: r.id,
      status: toUiStatus(eff),
      group: r.plan?.group?.name ?? r.plan?.name ?? "—",
      fromDate: r.start_date,
      toDate: r.end_date,
      balance: Math.round((cost - paid) * 100) / 100, // owed for this subscription
      planId: r.plan_id,
      cost,
      notes: r.notes ?? "",
      limits: { ...DEFAULT_SUBSCRIPTION_LIMITS, ...(limitsById[r.id] ?? {}) },
      isClassPlan,
      classesLimit,
      classesUsed,
    };
  });
}
type SubscriptionRow = {
  id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: string;
  price_paid: number | null;
  classes_used: number | null;
  notes: string | null;
  plan: { name: string; is_class_plan: boolean; classes_limit: number | null; group: { name: string } | null } | null;
};

/**
 * Active subscription packages for the New-Subscription "Group" picker. Each
 * subscription must reference a plan (FK), so the dialog offers the gym's real
 * packages (subscription_plans), labelled by their class group when set.
 */
export async function getSubscriptionPlanOptions(
  supabase: ServerSupabase,
  gymId: string
): Promise<SubscriptionPlanOption[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, name, price, period_months, is_class_plan, classes_limit, group:class_groups(name)")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load subscription packages: ${error.message}`);

  return ((data ?? []) as unknown as PlanOptionRow[]).map((p) => ({
    id: p.id,
    label: p.group?.name ?? p.name,
    planName: p.name,
    price: Number(p.price ?? 0),
    periodMonths: p.period_months ?? 1,
    isClassPlan: p.is_class_plan ?? false,
    classesLimit: p.classes_limit ?? null,
  }));
}
type PlanOptionRow = {
  id: string;
  name: string;
  price: number | null;
  period_months: number | null;
  is_class_plan: boolean | null;
  classes_limit: number | null;
  group: { name: string } | null;
};

/** Accounting documents (invoices / receipts) for this client. */
export const DOC_TYPE_LABELS: Record<string, string> = {
  tax_invoice: "Tax invoice",
  receipt: "Receipt",
  receipt_tax_invoice: "Receipt tax invoice",
  refund: "Refund invoice",
  non_formal_transaction: "Non Formal Transaction",
  informal: "Informal",
  bid: "Bid",
};

export async function getClientAccounting(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<AccountingDocument[]> {
  const { data, error } = await supabase
    .from("accounting_documents")
    .select("id, issued_on, doc_number, doc_type, vat, total")
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false }); // newest-added first (stack order)

  if (error) throw new Error(`Failed to load accounting documents: ${error.message}`);
  const docs = (data ?? []) as unknown as AccountingRow[];

  // How much has actually been paid against each document (payments.document_id).
  const paidByDoc = new Map<string, number>();
  if (docs.length) {
    const { data: pays, error: payErr } = await supabase
      .from("payments")
      .select("document_id, amount")
      .eq("gym_id", gymId)
      .in("document_id", docs.map((d) => d.id));
    if (payErr) throw new Error(`Failed to load payments: ${payErr.message}`);
    for (const p of (pays ?? []) as { document_id: string | null; amount: number }[]) {
      if (!p.document_id) continue;
      paidByDoc.set(p.document_id, (paidByDoc.get(p.document_id) ?? 0) + Number(p.amount));
    }
  }

  return docs.map((r) => ({
    id: r.id,
    date: r.issued_on,
    invoiceNo: r.doc_number,
    docType: r.doc_type,
    type: DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type,
    vat: Number(r.vat),
    amount: Number(r.total),
    paid: Math.round((paidByDoc.get(r.id) ?? 0) * 100) / 100,
  }));
}
type AccountingRow = { id: string; issued_on: string; doc_number: string; doc_type: string; vat: number; total: number };

/**
 * The gym's measurement fields (Settings · Measurement Types). These are the
 * columns the Fitness tab renders, so they always match Settings. Active only,
 * in the configured order.
 */
export async function getMeasurementTypes(
  supabase: ServerSupabase,
  gymId: string
): Promise<MeasurementType[]> {
  const { data, error } = await supabase
    .from("measurement_types")
    .select("id, name, unit")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load measurement types: ${error.message}`);
  return ((data ?? []) as { id: string; name: string; unit: string | null }[]).map((t) => ({
    id: t.id,
    name: t.name,
    unit: t.unit,
  }));
}

/**
 * Measurements in long format: each reading carries a value per measurement
 * type, keyed by type id so the Fitness tab can line them up under the dynamic
 * columns from getMeasurementTypes().
 */
export async function getClientMeasurements(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<MeasurementEntry[]> {
  const { data, error } = await supabase
    .from("client_measurements")
    .select("id, measured_on, values:client_measurement_values(value, measurement_type_id)")
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false }); // newest-added first (stack order)

  if (error) throw new Error(`Failed to load measurements: ${error.message}`);

  return ((data ?? []) as unknown as MeasurementRow[]).map((m) => {
    const values: Record<string, number> = {};
    for (const v of m.values ?? []) values[v.measurement_type_id] = Number(v.value);
    return { id: m.id, date: m.measured_on, values };
  });
}
type MeasurementRow = {
  id: string;
  measured_on: string;
  values: { value: number; measurement_type_id: string }[] | null;
};

/**
 * Attendance / classes history: the client's enrollments joined to their dated
 * session and class name. checkedIn = enrollment marked 'attended'.
 *
 * Only real spots count: 'booked' and 'attended'. A rejected/removed enrollment
 * (→ 'canceled', from the calendar or the veloFIT roster) or a 'no_show'
 * (bucketed as Rejected in the roster UI) must NOT appear as an enrollment with
 * check-in false — and a waitlisted client never held a spot at all.
 */
export async function getClientClassHistory(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<ClassHistoryEntry[]> {
  const { data, error } = await supabase
    .from("class_enrollments")
    .select(
      "id, status, session:class_sessions(session_date, start_time, end_time, notes, class:classes(name, kind:class_kinds(name)))"
    )
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .in("status", ["booked", "attended"]);

  if (error) throw new Error(`Failed to load classes history: ${error.message}`);

  return ((data ?? []) as unknown as EnrollmentRow[])
    .filter((e) => e.session)
    .map((e) => {
      const notes = (e.session!.notes ?? "").trim();
      return {
        id: e.id,
        date: e.session!.session_date,
        startTime: e.session!.start_time.slice(0, 5),
        endTime: e.session!.end_time.slice(0, 5),
        className: e.session!.class?.name ?? e.session!.class?.kind?.name ?? "—",
        checkedIn: e.status === "attended",
        hasNotes: notes.length > 0,
        notes,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
type EnrollmentRow = {
  id: string;
  status: string;
  session: {
    session_date: string;
    start_time: string;
    end_time: string;
    notes: string | null;
    class: { name: string | null; kind: { name: string } | null } | null;
  } | null;
};

export async function getClientEditData(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<ClientEditData | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("full_name, phone, phone2, email, national_id, gender, birth_date, city, address, notes, messaging_opt")
    .eq("gym_id", gymId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!data) return null;
  const c = data as Record<string, unknown>;

  return {
    fullName: (c.full_name as string) ?? "",
    phone: (c.phone as string) ?? "",
    phone2: (c.phone2 as string) ?? "",
    email: (c.email as string) ?? "",
    nationalId: (c.national_id as string) ?? "",
    gender: (c.gender as ClientEditData["gender"]) ?? "",
    birthDate: (c.birth_date as string) ?? "",
    city: (c.city as string) ?? "",
    address: (c.address as string) ?? "",
    notes: (c.notes as string) ?? "",
    messagingOpt: (c.messaging_opt as boolean) ?? true,
  };
}

/**
 * Communication log: messages (SMS / app notifications) sent to this client.
 * channel → display type; sent_at falls back to created_at for queued rows.
 */
export async function getClientCommunications(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<Communication[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, channel, content, sent_at, created_at")
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load communications: ${error.message}`);

  return ((data ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    date: m.sent_at ?? m.created_at,
    type: m.channel === "app" ? "App Notification" : "SMS",
    content: m.content,
  }));
}
type MessageRow = {
  id: string;
  channel: string;
  content: string;
  sent_at: string | null;
  created_at: string;
};

/** Tasks scoped to this client (CRM · client Tasks tab), newest first. */
export async function getClientTasks(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<ClientTask[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, task_date, reminder_at, blocking_entry")
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .order("task_date", { ascending: false });

  if (error) throw new Error(`Failed to load tasks: ${error.message}`);

  return ((data ?? []) as TaskRow[]).map((t) => ({
    id: t.id,
    date: t.task_date,
    title: t.title,
    status: t.status,
    blockingEntry: t.blocking_entry,
    reminderDate: t.reminder_at ? t.reminder_at.slice(0, 10) : null,
  }));
}
type TaskRow = {
  id: string;
  title: string;
  status: string;
  task_date: string;
  reminder_at: string | null;
  blocking_entry: boolean;
};

/** Audit trail for this client (activity_logs), newest first. */
const ACTIVITY_ACTION_LABEL: Record<string, ActivityLog["action"]> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
};

export async function getClientActivityLogs(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_name, created_at, actor:profiles(full_name)")
    .eq("gym_id", gymId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load activity logs: ${error.message}`);

  return ((data ?? []) as unknown as ActivityRow[]).map((r) => ({
    id: r.id,
    date: r.created_at,
    action: ACTIVITY_ACTION_LABEL[r.action] ?? "Update",
    item: r.entity_type,
    name: r.entity_name ?? "—",
    initiatedBy: r.actor?.full_name ?? "System",
  }));
}
type ActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

/**
 * A client's linked family members. Links live in gyms.settings.family
 * ({ [clientId]: memberClientId[] }) — an interim store until a dedicated
 * family_members table is migrated. Resolves the linked ids to client details.
 */
export async function getFamilyMembers(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string
): Promise<FamilyMember[]> {
  const { data: gym, error } = await supabase.from("gyms").select("settings").eq("id", gymId).maybeSingle();
  if (error) throw new Error(`Failed to load family members: ${error.message}`);

  const family = ((gym?.settings as { family?: Record<string, string[]> } | null)?.family ?? {}) as Record<string, string[]>;
  const memberIds = family[clientId] ?? [];
  if (memberIds.length === 0) return [];

  const { data, error: clientsError } = await supabase
    .from("clients")
    .select("id, full_name, client_number, phone, birth_date")
    .eq("gym_id", gymId)
    .in("id", memberIds);
  if (clientsError) throw new Error(`Failed to load family members: ${clientsError.message}`);

  return ((data ?? []) as { id: string; full_name: string; client_number: number | null; phone: string | null; birth_date: string | null }[])
    .map((c) => ({ id: c.id, fullName: c.full_name, clientNumber: c.client_number ?? 0, phone: c.phone ?? "", birthDate: c.birth_date }));
}
