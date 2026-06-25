"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { DOC_TYPE_LABELS } from "@/lib/clients-server";
import type { AccountingDocument } from "@/lib/clients";

/**
 * Client write operations. Every action:
 *   - runs through getAuthedProfile() (auth gate; redirects if unauthenticated),
 *   - derives gym_id from the AUTHED PROFILE — never from the client payload, and
 *   - validates input with Zod (schema-aligned: required fields, nullable text).
 * RLS independently scopes writes to the gym; the explicit gym_id filter on
 * update/archive is defense-in-depth.
 */

export type ActionResult = { ok: true; id: string; docNumber?: string } | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid email address");

// "" → null for nullable text columns.
const nullable = (v: string) => {
  const t = v.trim();
  return t === "" ? null : t;
};

// ── Create ───────────────────────────────────────────────────────────────────
const clientCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string(),
  lastName: z.string().trim().min(1, "Last name is required"),
  birthDate: z.string().min(1, "Birth date is required"),
  countryCode: z.string(),
  phone: z.string().trim().min(1, "Phone number is required"),
  nationalId: z.string(),
  phone2: z.string(),
  email: optionalEmail,
  gender: z.enum(["male", "female"]),
  messagingService: z.boolean(),
  city: z.string(),
  address: z.string(),
  notes: z.string(),
  sendWelcomeMessage: z.boolean(),
});

export type NewClientInput = z.infer<typeof clientCreateSchema>;

export async function createClient(input: NewClientInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const fullName = [v.firstName, v.middleName, v.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  const { data, error } = await supabase
    .from("clients")
    .insert({
      gym_id: profile.gymId, // ← tenant from the authed session, not the UI
      full_name: fullName,
      phone: `${v.countryCode} ${v.phone}`.trim(),
      phone2: nullable(v.phone2),
      national_id: nullable(v.nationalId),
      email: nullable(v.email),
      gender: v.gender,
      birth_date: nullable(v.birthDate),
      city: nullable(v.city),
      address: nullable(v.address),
      notes: nullable(v.notes),
      messaging_opt: v.messagingService,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  // PHASE 2: when an SMS provider is wired, honor v.sendWelcomeMessage here by
  // enqueueing a welcome message. The toggle is disabled in the UI until then.

  revalidatePath("/clients");
  return { ok: true, id: data.id };
}

// ── Update ───────────────────────────────────────────────────────────────────
const clientUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  phone: z.string(),
  phone2: z.string(),
  email: optionalEmail,
  nationalId: z.string(),
  gender: z.enum(["male", "female", "other"]),
  birthDate: z.string(),
  city: z.string(),
  address: z.string(),
  notes: z.string(),
  messagingService: z.boolean(),
});

export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export async function updateClient(id: string, input: ClientUpdateInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: v.fullName.trim(),
      phone: nullable(v.phone),
      phone2: nullable(v.phone2),
      national_id: nullable(v.nationalId),
      email: nullable(v.email),
      gender: v.gender,
      birth_date: nullable(v.birthDate),
      city: nullable(v.city),
      address: nullable(v.address),
      notes: nullable(v.notes),
      messaging_opt: v.messagingService,
    })
    .eq("id", id)
    .eq("gym_id", profile.gymId); // gym-scoped (RLS + explicit)

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, profile.gymId, profile.userId, id, "update", "Client Data");
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id };
}

// ── Archive (soft delete) ─────────────────────────────────────────────────────
export async function archiveClient(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error } = await supabase
    .from("clients")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("gym_id", profile.gymId);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, profile.gymId, profile.userId, id, "update", "Client", "Archived");
  revalidatePath("/clients");
  revalidatePath("/archive/clients");
  return { ok: true, id };
}

// ── Door entrance (check-in) ──────────────────────────────────────────────────
/**
 * Record a door check-in for a client and tie it to the most recent class.
 *
 * It finds the most relevant session today (the latest one that has already
 * started, else the next upcoming one); if the gym has no class today, it falls
 * back to the gym's most recent past class — so the entry always attaches to a
 * class. The client is marked *attended* in that class, and the entrance is
 * stamped at that class's **scheduled time** (date + start_time), NOT the moment
 * the button was clicked — staff often log attendance after the class ends — so
 * "Last Entrance" reflects the class. Only with no class at all does it use now.
 * Also feeds the dashboard's "Today Entrances".
 */
export async function registerEntrance(clientId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;

  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const nowTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

  // Today's live sessions, earliest first.
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time")
    .eq("gym_id", gymId)
    .eq("session_date", today)
    .neq("status", "canceled")
    .order("start_time", { ascending: true });

  // Pick the most recent class that has started; otherwise the next one up.
  let target: { id: string; session_date: string; start_time: string } | null = null;
  const list = (sessions ?? []) as { id: string; session_date: string; start_time: string }[];
  if (list.length) {
    const started = list.filter((s) => s.start_time <= nowTime);
    target = started.length ? started[started.length - 1] : list[0];
  }

  // No class today → attach to the gym's most recent past class.
  if (!target) {
    const { data: past } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time")
      .eq("gym_id", gymId)
      .lt("session_date", today)
      .neq("status", "canceled")
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(1);
    target = ((past ?? [])[0] as { id: string; session_date: string; start_time: string } | undefined) ?? null;
  }

  const sessionId = target?.id ?? null;
  // Stamp at the class's SCHEDULED time (date + start_time), NOT the moment the
  // button was clicked — staff often log attendance well after the class ends.
  // Only fall back to "now" when there's no class to attach the entrance to.
  let checkedInAt: string;
  if (target) {
    const [y, m, d] = target.session_date.split("-").map(Number);
    const [hh, mm, ss] = target.start_time.split(":").map(Number);
    checkedInAt = new Date(y, m - 1, d, hh, mm, ss || 0).toISOString();
  } else {
    checkedInAt = now.toISOString();
  }

  // Add the client to that class as attended (upsert; capacity-full is non-fatal —
  // they physically showed up, so we still log the entrance).
  if (sessionId) {
    const { data: existingEnr } = await supabase
      .from("class_enrollments")
      .select("id, status")
      .eq("gym_id", gymId)
      .eq("session_id", sessionId)
      .eq("client_id", clientId)
      .maybeSingle();
    const enr = existingEnr as { id: string; status: string } | null;
    if (enr) {
      if (enr.status !== "attended") {
        await supabase.from("class_enrollments").update({ status: "attended" }).eq("id", enr.id).eq("gym_id", gymId);
      }
    } else {
      await supabase
        .from("class_enrollments")
        .insert({ gym_id: gymId, session_id: sessionId, client_id: clientId, status: "attended" });
    }

    // Don't double-log the same class.
    const { data: existingAtt } = await supabase
      .from("attendances")
      .select("id")
      .eq("gym_id", gymId)
      .eq("session_id", sessionId)
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();
    if (existingAtt) {
      revalidatePath(`/clients/${clientId}`);
      return { ok: true, id: (existingAtt as { id: string }).id };
    }
  }

  const { data, error } = await supabase
    .from("attendances")
    .insert({ gym_id: gymId, client_id: clientId, session_id: sessionId, checked_in_at: checkedInAt })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/classes/calendar");
  return { ok: true, id: data.id };
}

// =============================================================================
// Client profile sub-resources — real, tenant-scoped writes.
//
// Every action derives gym_id from the authed profile, and RLS independently
// scopes the row to the gym. Validation is intentionally light (the UI already
// constrains inputs); the DB checks/FKs are the real guard.
// =============================================================================

type ServerSupabase = Awaited<ReturnType<typeof getAuthedProfile>>["supabase"];

/**
 * Best-effort audit entry → activity_logs (drives the client's Activity Logs).
 * Never throws / blocks the main action; a failed log is silently ignored.
 */
async function logActivity(
  supabase: ServerSupabase,
  gymId: string,
  actorId: string,
  clientId: string,
  action: "create" | "update" | "delete",
  entityType: string,
  entityName?: string | null
): Promise<void> {
  await supabase.from("activity_logs").insert({
    gym_id: gymId,
    client_id: clientId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_name: entityName ?? null,
  });
}

// UI document-type value → document_type enum. (UI "refund_invoice" → DB "refund".)
const DOC_TYPE_MAP: Record<string, string> = {
  receipt_tax_invoice: "receipt_tax_invoice",
  tax_invoice: "tax_invoice",
  refund_invoice: "refund",
  receipt: "receipt",
  informal: "informal",
  bid: "bid",
  non_formal_transaction: "non_formal_transaction",
};
// Which UI document types take money (and so write a payment row).
const DOC_HAS_PAYMENT = new Set(["receipt_tax_invoice", "receipt", "informal"]);

// Document types that legally carry VAT (keyed by the document_type enum). VAT is
// computed tax-INCLUSIVE: the amount entered already includes it, matching the
// finance report's "with VAT" bucket.
const VAT_BEARING_DOC_TYPES = new Set(["tax_invoice", "receipt_tax_invoice"]);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Split a tax-inclusive total into net + VAT (0 for non-VAT docs or a 0% rate). */
function splitVat(total: number, ratePercent: number, bearing: boolean): { subtotal: number; vat: number } {
  if (!bearing || ratePercent <= 0) return { subtotal: round2(total), vat: 0 };
  const subtotal = round2(total / (1 + ratePercent / 100));
  return { subtotal, vat: round2(total - subtotal) }; // subtotal + vat === total
}
/** Gym VAT rate (percent) from settings.business.vatRate; defaults to 18 (Israel). */
async function getGymVatRate(supabase: ServerSupabase, gymId: string): Promise<number> {
  const { data } = await supabase.from("gyms").select("settings").eq("id", gymId).maybeSingle();
  const rate = Number((data?.settings as { business?: { vatRate?: number } } | null)?.business?.vatRate);
  return Number.isFinite(rate) && rate >= 0 ? rate : 18;
}
// UI payment method → payment_method enum.
const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: "cash",
  card: "credit_card",
  cheque: "cheque",
  transfer: "bank_transfer",
};

type PaymentInput = { method: string; amount: number; reference?: string } | null | undefined;

/**
 * Create an accounting document and, for payment-bearing types, a matching
 * payment row. Returns the new document id. Used by the Accounting tab and the
 * subscription / package purchase flows.
 */
async function insertDocument(
  supabase: ServerSupabase,
  gymId: string,
  createdBy: string,
  args: {
    clientId: string;
    docTypeUi: string;
    issuedOn: string;
    total: number;
    payment?: PaymentInput;
    subscriptionId?: string | null;
  }
): Promise<{ ok: true; id: string; docNumber: string; subtotal: number; vat: number } | { ok: false; error: string }> {
  const docType = DOC_TYPE_MAP[args.docTypeUi];
  if (!docType) return { ok: false, error: "Unknown document type." };

  // Tax-inclusive VAT split: net + VAT are derived from the entered total using
  // the gym's configured rate (VAT-bearing document types only).
  const vatRate = await getGymVatRate(supabase, gymId);
  const { subtotal, vat } = splitVat(args.total, vatRate, VAT_BEARING_DOC_TYPES.has(docType));

  // doc_number is deliberately omitted: a BEFORE INSERT trigger allocates the
  // next gapless number for (gym_id, doc_type) inside this same transaction
  // (see migration 00004). .select() reads the DB-assigned value straight back.
  const { data, error } = await supabase
    .from("accounting_documents")
    .insert({
      gym_id: gymId,
      client_id: args.clientId,
      doc_type: docType,
      issued_on: args.issuedOn,
      subtotal,
      vat,
      total: args.total,
      created_by: createdBy,
    })
    .select("id, doc_number")
    .single();
  if (error) return { ok: false, error: error.message };
  const documentId = data.id as string;
  const docNumber = data.doc_number as string;

  const pay = args.payment;
  if (pay && pay.amount > 0 && DOC_HAS_PAYMENT.has(args.docTypeUi)) {
    const method = PAYMENT_METHOD_MAP[pay.method] ?? "cash";
    const reference = pay.reference?.trim() || null;
    const { error: payErr } = await supabase.from("payments").insert({
      gym_id: gymId,
      client_id: args.clientId,
      document_id: documentId,
      subscription_id: args.subscriptionId ?? null,
      method,
      amount: pay.amount,
      paid_at: `${args.issuedOn}T12:00:00`,
      reference,
      // For card payments the reference is the terminal confirmation/approval
      // code — also store it as the gateway txn id so it shows in the
      // Credit-Card Transactions report.
      gateway_txn_id: method === "credit_card" ? reference : null,
      created_by: createdBy,
    });
    // A failed payment shouldn't strand the document; surface the error but keep the doc.
    if (payErr) return { ok: false, error: payErr.message };
  }

  await logActivity(supabase, gymId, createdBy, args.clientId, "create", "Accounting Document", DOC_TYPE_MAP[args.docTypeUi]);
  return { ok: true, id: documentId, docNumber, subtotal, vat };
}

// ── Subscriptions ──────────────────────────────────────────────────────────

/** Per-subscription enrollment caps + cancellation balance + auto-enroll. */
const limitsSchema = z.object({
  maxPerDay: z.number().min(0),
  maxPerWeek: z.number().min(0),
  maxPerMonth: z.number().min(0),
  maxTotal: z.number().min(0),
  cancellationBalance: z.number(),
  autoEnroll: z.boolean(),
});

/**
 * Read-modify-write the subscription's caps into the interim
 * gyms.settings->'subscriptionLimits' store (the subscriptions table has no
 * columns for these). Pass `limits` undefined to remove the entry (on delete).
 */
async function writeSubscriptionLimits(
  supabase: ServerSupabase,
  gymId: string,
  subscriptionId: string,
  limits: z.infer<typeof limitsSchema> | undefined
): Promise<void> {
  const { data: gym } = await supabase.from("gyms").select("settings").eq("id", gymId).maybeSingle();
  const settings = ((gym?.settings as Record<string, unknown> | null) ?? {});
  const all = { ...((settings.subscriptionLimits as Record<string, unknown>) ?? {}) };
  if (limits) all[subscriptionId] = limits;
  else delete all[subscriptionId];
  await supabase.from("gyms").update({ settings: { ...settings, subscriptionLimits: all } }).eq("id", gymId);
}

const subscriptionCreateSchema = z.object({
  planId: z.string().uuid("Pick a subscription package"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  cost: z.number().min(0),
  notes: z.string(),
  documentType: z.string().optional(),
  payment: z.object({ method: z.string(), amount: z.number(), reference: z.string().optional() }).nullable().optional(),
  limits: limitsSchema.optional(),
});
export type NewSubscriptionInput = z.infer<typeof subscriptionCreateSchema>;

export async function createSubscription(
  clientId: string,
  input: NewSubscriptionInput
): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = subscriptionCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      gym_id: profile.gymId,
      client_id: clientId,
      plan_id: v.planId,
      status: "active",
      start_date: v.startDate,
      end_date: v.endDate,
      price_paid: v.cost,
      notes: nullable(v.notes),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const subscriptionId = data.id as string;

  await writeSubscriptionLimits(supabase, profile.gymId, subscriptionId, v.limits);
  await logActivity(supabase, profile.gymId, profile.userId, clientId, "create", "Classes Subscription");

  // A paid subscription generates its accounting document (matches the reference).
  if (v.cost > 0 && v.documentType) {
    const doc = await insertDocument(supabase, profile.gymId, profile.userId, {
      clientId,
      docTypeUi: v.documentType,
      issuedOn: v.startDate,
      total: v.cost,
      payment: v.payment,
      subscriptionId,
    });
    if (!doc.ok) return { ok: false, error: doc.error };
  }

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: subscriptionId };
}

const subscriptionUpdateSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  cost: z.number().min(0),
  notes: z.string(),
  limits: limitsSchema.optional(),
});
export type UpdateSubscriptionInput = z.infer<typeof subscriptionUpdateSchema>;

export async function updateSubscription(
  id: string,
  clientId: string,
  input: UpdateSubscriptionInput
): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = subscriptionUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .from("subscriptions")
    .update({
      start_date: v.startDate,
      end_date: v.endDate,
      price_paid: v.cost,
      notes: nullable(v.notes),
    })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  await writeSubscriptionLimits(supabase, profile.gymId, id, v.limits);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id };
}

export async function deleteSubscription(id: string, clientId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  await writeSubscriptionLimits(supabase, profile.gymId, id, undefined); // drop its caps
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id };
}

// ── Subscription history (real audit trail for one subscription) ─────────────
export type SubscriptionEvent = { id: string; date: string; action: string; details: string; by: string };

const HISTORY_DOC_LABELS: Record<string, string> = {
  tax_invoice: "Tax invoice",
  receipt: "Receipt",
  receipt_tax_invoice: "Receipt tax invoice",
  refund: "Refund invoice",
  non_formal_transaction: "Non Formal Transaction",
  informal: "Informal",
  bid: "Bid",
};

type HistorySubRow = {
  id: string;
  start_date: string;
  end_date: string;
  price_paid: number | null;
  plan: { name: string; group: { name: string } | null } | null;
};
type HistoryPayRow = {
  id: string;
  method: string;
  amount: number;
  paid_at: string | null;
  document: { doc_type: string; doc_number: string } | null;
  creator: { full_name: string } | null;
};

/**
 * Real, tenant-scoped history for a single subscription: its creation, every
 * payment made toward it (with the linked accounting document), and its
 * renewal/expiry date. Replaces the old fabricated mock.
 */
export async function getSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data: subData, error: subErr } = await supabase
    .from("subscriptions")
    .select("id, start_date, end_date, price_paid, plan:subscription_plans(name, group:class_groups(name))")
    .eq("id", subscriptionId)
    .eq("gym_id", profile.gymId)
    .maybeSingle();
  if (subErr) return [];
  const sub = subData as unknown as HistorySubRow | null;
  if (!sub) return [];

  const { data: payData } = await supabase
    .from("payments")
    .select("id, method, amount, paid_at, document:accounting_documents(doc_type, doc_number), creator:profiles(full_name)")
    .eq("gym_id", profile.gymId)
    .eq("subscription_id", subscriptionId)
    .order("paid_at", { ascending: true });

  const money = (n: number) => `₪${Number(n).toFixed(2)}`;
  const groupName = sub.plan?.group?.name ?? sub.plan?.name ?? "—";

  const events: SubscriptionEvent[] = [
    { id: `created-${sub.id}`, date: sub.start_date, action: "Created", details: groupName, by: "System" },
  ];

  for (const p of (payData ?? []) as unknown as HistoryPayRow[]) {
    const doc = p.document ? `${HISTORY_DOC_LABELS[p.document.doc_type] ?? p.document.doc_type} #${p.document.doc_number}` : "";
    events.push({
      id: p.id,
      date: (p.paid_at ?? sub.start_date).slice(0, 10),
      action: "Payment",
      details: doc ? `${money(p.amount)} · ${doc}` : money(p.amount),
      by: p.creator?.full_name ?? "System",
    });
  }

  events.push({ id: `expiry-${sub.id}`, date: sub.end_date, action: "Renewal due", details: groupName, by: "System" });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Accounting documents ─────────────────────────────────────────────────────
const documentCreateSchema = z.object({
  docType: z.string().min(1, "Document type is required"),
  issuedOn: z.string().min(1, "Date is required"),
  total: z.number().min(0),
  payment: z.object({ method: z.string(), amount: z.number(), reference: z.string().optional() }).nullable().optional(),
});
export type NewDocumentInput = z.infer<typeof documentCreateSchema>;

/** Carries the freshly-created, canonical document row so the UI can render it
 *  optimistically (same shape getClientAccounting returns — no divergence). */
export type CreateDocumentResult =
  | { ok: true; id: string; docNumber: string; document: AccountingDocument }
  | { ok: false; error: string };

export async function createAccountingDocument(
  clientId: string,
  input: NewDocumentInput
): Promise<CreateDocumentResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = documentCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const doc = await insertDocument(supabase, profile.gymId, profile.userId, {
    clientId,
    docTypeUi: v.docType,
    issuedOn: v.issuedOn,
    total: v.total,
    payment: v.payment,
  });
  if (!doc.ok) return { ok: false, error: doc.error };

  // Build the row exactly as getClientAccounting would map it (DB enum → label),
  // so the optimistic insert matches the post-refresh server row 1:1.
  const dbType = DOC_TYPE_MAP[v.docType];
  const document: AccountingDocument = {
    id: doc.id,
    date: v.issuedOn,
    invoiceNo: doc.docNumber,
    type: DOC_TYPE_LABELS[dbType] ?? dbType,
    vat: doc.vat,
    amount: v.total,
  };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: doc.id, docNumber: doc.docNumber, document };
}

// ── Measurements ─────────────────────────────────────────────────────────────
const measurementCreateSchema = z.object({
  measuredOn: z.string().min(1, "Date is required"),
  values: z.array(z.object({ typeId: z.string().uuid(), value: z.number() })),
});
export type NewMeasurementInput = z.infer<typeof measurementCreateSchema>;

export async function addMeasurement(
  clientId: string,
  input: NewMeasurementInput
): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = measurementCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("client_measurements")
    .insert({
      gym_id: profile.gymId,
      client_id: clientId,
      measured_on: v.measuredOn,
      recorded_by: profile.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const measurementId = data.id as string;

  const rows = v.values.map((x) => ({
    gym_id: profile.gymId,
    measurement_id: measurementId,
    measurement_type_id: x.typeId,
    value: x.value,
  }));
  if (rows.length > 0) {
    const { error: valErr } = await supabase.from("client_measurement_values").insert(rows);
    if (valErr) {
      // Roll back the parent so we never leave an empty measurement behind.
      await supabase.from("client_measurements").delete().eq("id", measurementId);
      return { ok: false, error: valErr.message };
    }
  }

  await logActivity(supabase, profile.gymId, profile.userId, clientId, "create", "Measurement", v.measuredOn);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: measurementId };
}

export async function deleteMeasurement(id: string, clientId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("client_measurements")
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id };
}

export async function updateMeasurement(
  id: string,
  clientId: string,
  input: NewMeasurementInput
): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = measurementCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error: dateErr } = await supabase
    .from("client_measurements")
    .update({ measured_on: v.measuredOn })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (dateErr) return { ok: false, error: dateErr.message };

  // Replace this measurement's values with the submitted set.
  const { error: delErr } = await supabase
    .from("client_measurement_values")
    .delete()
    .eq("gym_id", profile.gymId)
    .eq("measurement_id", id);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = v.values.map((x) => ({
    gym_id: profile.gymId,
    measurement_id: id,
    measurement_type_id: x.typeId,
    value: x.value,
  }));
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("client_measurement_values").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id };
}

// ── Tasks ────────────────────────────────────────────────────────────────────
const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  taskDate: z.string().min(1, "Date is required"),
  status: z.enum(["new", "in_progress", "canceled", "finished"]),
  reminderDate: z.string(),
  blockingEntry: z.boolean(),
});
export type NewClientTaskInput = z.infer<typeof taskCreateSchema>;

export async function createClientTask(
  clientId: string,
  input: NewClientTaskInput
): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      gym_id: profile.gymId,
      client_id: clientId,
      title: v.title,
      status: v.status,
      task_date: v.taskDate,
      reminder_at: v.reminderDate ? `${v.reminderDate}T00:00:00` : null,
      blocking_entry: v.blockingEntry,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, profile.gymId, profile.userId, clientId, "create", "Task", v.title);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: data.id };
}

export async function deleteClientTask(id: string, clientId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id };
}
