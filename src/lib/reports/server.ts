import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { type Gender } from "@/lib/clients";
import { type IdName } from "@/lib/classes";
import { type SubscriptionRow, type SubscriptionsData, type SubscriptionStatus, monthsBetween } from "@/lib/reports/subscriptions";
import { type AbsenceData, type AbsenceRow } from "@/lib/reports/classes-absence";
import { type NewSubscriptionRow } from "@/lib/reports/new-subscriptions";
import { type InactiveClientRow } from "@/lib/reports/inactive-clients";
import { type BirthdayRow } from "@/lib/reports/birthdays";
import { type FinanceDocument } from "@/lib/reports/finance-documents";
import { type FinancePayment, type PaymentMethod } from "@/lib/reports/finance-payments";
import { type FinanceCharge } from "@/lib/reports/finance-charges";
import { type CreditCardTxn } from "@/lib/reports/credit-card";
import { type Order, type OrderStatus } from "@/lib/reports/orders";
import { type SoldItem } from "@/lib/reports/sold-items";
import { type LeadRow } from "@/lib/reports/leads-report";
import { type MessageRow } from "@/lib/reports/messages-report";
import { type Shift } from "@/lib/reports/employee-presence";
import { type TrainerHourRow } from "@/lib/reports/trainer-hours";
import { ageFrom } from "@/lib/reports/format";

/**
 * Server-only report data layer. Every fetcher is RLS-scoped via getAuthedProfile.
 * Aggregations are done in JS (PostgREST has no GROUP BY) — fine at gym scale.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DOC_TYPE_LABELS: Record<string, string> = {
  tax_invoice: "Tax Invoice",
  receipt: "Receipt",
  receipt_tax_invoice: "Receipt tax invoice",
  refund: "Refund",
  non_formal_transaction: "Non Formal Transaction",
  informal: "Informal",
  bid: "Bid",
};

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  cash: "cash",
  credit_card: "creditCard",
  cheque: "cheques",
  bank_transfer: "bankTransfer",
  direct_debit: "bankTransfer",
};

// ── Subscriptions (shared base for 5 reports) ───────────────────────────────
type SubBaseRow = {
  id: string;
  client_id: string;
  status: string;
  start_date: string;
  end_date: string;
  price_paid: number;
  is_direct_debit: boolean;
  installments_total: number | null;
  installments_paid: number;
  client: { full_name: string; national_id: string | null; phone: string | null; gender: string | null } | null;
  plan: { name: string; period_months: number; classes_limit: number | null; group: { name: string } | null } | null;
};

function effectiveStatus(status: string, start: string, end: string, today: string): SubscriptionStatus {
  if (status === "canceled") return "cancelled";
  if (status === "frozen" || status === "expired") return "inactive";
  if (status === "pending") return "future";
  // active
  if (end < today) return "inactive";
  if (start > today) return "future";
  return "active";
}

async function fetchSubscriptions(supabase: ServerSupabase, gymId: string): Promise<SubBaseRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `id, client_id, status, start_date, end_date, price_paid, is_direct_debit, installments_total, installments_paid,
       client:clients(full_name, national_id, phone, gender),
       plan:subscription_plans(name, period_months, classes_limit, group:class_groups(name))`
    )
    .eq("gym_id", gymId)
    .order("start_date", { ascending: false });
  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);
  return (data ?? []) as unknown as SubBaseRow[];
}

/**
 * Enrollment counts (booked/attended) keyed by subscription_id. Aggregated in
 * Postgres via the subscription_enrollment_counts() RPC (GROUP BY) so only one
 * row per subscription crosses the wire — not every enrollment. Scales to 100k+
 * enrollments. See supabase/migrations/00006_subscription_enrollment_counts.sql.
 */
async function enrollmentCounts(supabase: ServerSupabase): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("subscription_enrollment_counts");
  if (error) throw new Error(`Failed to load enrollment counts: ${error.message}`);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { subscription_id: string; cnt: number }[]) {
    counts.set(r.subscription_id, Number(r.cnt));
  }
  return counts;
}

/** Mark each client's earliest subscription as original, the rest as renewals. */
function renewalFlags(rows: SubBaseRow[]): Map<string, boolean> {
  const earliest = new Map<string, string>();
  for (const r of rows) {
    const cur = earliest.get(r.client_id);
    if (!cur || r.start_date < cur) earliest.set(r.client_id, r.start_date);
  }
  const flags = new Map<string, boolean>();
  for (const r of rows) flags.set(r.id, r.start_date !== earliest.get(r.client_id));
  return flags;
}

function toRow(r: SubBaseRow, today: string, isRenewal: boolean): SubscriptionRow {
  return {
    id: r.id,
    clientId: r.client_id,
    fullName: r.client?.full_name ?? "—",
    memberId: r.client?.national_id ?? "",
    phone: r.client?.phone ?? "",
    group: r.plan?.group?.name ?? r.plan?.name ?? "—",
    status: effectiveStatus(r.status, r.start_date, r.end_date, today),
    startDate: r.start_date,
    expireDate: r.end_date,
    cost: Number(r.price_paid),
    gender: (r.client?.gender as Gender) ?? "other",
    isRenewal,
  };
}

function uniqueGroups(rows: SubBaseRow[]): string[] {
  return [...new Set(rows.map((r) => r.plan?.group?.name ?? r.plan?.name ?? "—"))];
}

export async function getSubscriptionRows(): Promise<SubscriptionsData> {
  const { supabase, profile } = await getAuthedProfile();
  const rows = await fetchSubscriptions(supabase, profile.gymId);
  const today = todayISO();
  const renewals = renewalFlags(rows);
  return { rows: rows.map((r) => toRow(r, today, renewals.get(r.id) ?? false)), groups: uniqueGroups(rows) };
}

export async function getRenewalRows(): Promise<SubscriptionsData> {
  const { supabase, profile } = await getAuthedProfile();
  const all = await fetchSubscriptions(supabase, profile.gymId);
  const today = todayISO();
  const renewals = renewalFlags(all);
  const active = all.filter((r) => effectiveStatus(r.status, r.start_date, r.end_date, today) === "active");
  return { rows: active.map((r) => toRow(r, today, renewals.get(r.id) ?? false)), groups: uniqueGroups(all) };
}

export async function getBalanceRows(): Promise<SubscriptionsData> {
  const { supabase, profile } = await getAuthedProfile();
  const [all, counts] = await Promise.all([fetchSubscriptions(supabase, profile.gymId), enrollmentCounts(supabase)]);
  const today = todayISO();
  const renewals = renewalFlags(all);
  const active = all.filter((r) => effectiveStatus(r.status, r.start_date, r.end_date, today) === "active");
  const rows = active.map((r) => ({
    ...toRow(r, today, renewals.get(r.id) ?? false),
    classesEnrolled: counts.get(r.id) ?? 0,
    maxEnrollments: r.plan?.classes_limit ?? null,
  }));
  return { rows, groups: uniqueGroups(all) };
}

export async function getNoEnrollmentRows(): Promise<SubscriptionsData> {
  const { supabase, profile } = await getAuthedProfile();
  const [all, counts] = await Promise.all([fetchSubscriptions(supabase, profile.gymId), enrollmentCounts(supabase)]);
  const today = todayISO();
  const renewals = renewalFlags(all);
  const rows = all
    .filter((r) => effectiveStatus(r.status, r.start_date, r.end_date, today) === "active" && (counts.get(r.id) ?? 0) === 0)
    .map((r) => toRow(r, today, renewals.get(r.id) ?? false));
  return { rows, groups: uniqueGroups(all) };
}

export async function getDirectDebitRows(): Promise<SubscriptionsData> {
  const { supabase, profile } = await getAuthedProfile();
  const all = await fetchSubscriptions(supabase, profile.gymId);
  const today = todayISO();
  const renewals = renewalFlags(all);
  const rows = all
    .filter((r) => r.is_direct_debit)
    .map((r) => ({
      ...toRow(r, today, renewals.get(r.id) ?? false),
      succeedPayments: r.installments_paid,
      totalPayments: r.installments_total ?? 0,
      isMonthly: (r.plan?.period_months ?? 1) === 1,
    }));
  return { rows, groups: uniqueGroups(all) };
}

// ── Classes Absence ──────────────────────────────────────────────────────────
export async function getClassesAbsenceReport(): Promise<AbsenceData> {
  const { supabase, profile } = await getAuthedProfile();
  const today = todayISO();
  const all = await fetchSubscriptions(supabase, profile.gymId);
  const active = all.filter((r) => effectiveStatus(r.status, r.start_date, r.end_date, today) === "active");

  // Latest attendance per client — aggregated in Postgres (DISTINCT ON) so only
  // one row per client crosses the wire, not the whole attendances table.
  // See supabase/migrations/00007_latest_attendance_per_client.sql.
  const { data: att, error } = await supabase.rpc("latest_attendance_per_client");
  if (error) throw new Error(`Failed to load attendances: ${error.message}`);
  const lastEntrance = new Map<string, string>();
  for (const a of (att ?? []) as { client_id: string; last_at: string }[]) {
    lastEntrance.set(a.client_id, a.last_at);
  }

  const rows: AbsenceRow[] = active.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    fullName: r.client?.full_name ?? "—",
    memberId: r.client?.national_id ?? "",
    phone: r.client?.phone ?? "",
    group: r.plan?.group?.name ?? r.plan?.name ?? "—",
    startDate: r.start_date,
    expireDate: r.end_date,
    lastEntrance: lastEntrance.get(r.client_id) ?? null,
    durationMonths: r.plan?.period_months ?? monthsBetween(r.start_date, r.end_date),
  }));
  return { rows, groups: uniqueGroups(all) };
}

// ── New subscriptions ─────────────────────────────────────────────────────────
export async function getNewSubscriptions(): Promise<NewSubscriptionRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const rows = await fetchSubscriptions(supabase, profile.gymId);
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    fullName: r.client?.full_name ?? "—",
    phone: r.client?.phone ?? "",
    group: r.plan?.group?.name ?? r.plan?.name ?? "—",
    joiningDate: r.start_date,
  }));
}

// ── Inactive clients (no active subscription) ───────────────────────────────
export async function getInactiveClients(): Promise<InactiveClientRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const today = todayISO();

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone, gender, birth_date, subscriptions(status, start_date, end_date, plan:subscription_plans(name, group:class_groups(name)))")
    .eq("gym_id", profile.gymId)
    .neq("status", "archived");
  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  type Row = {
    id: string;
    full_name: string;
    phone: string | null;
    gender: string | null;
    birth_date: string | null;
    subscriptions: { status: string; start_date: string; end_date: string; plan: { name: string; group: { name: string } | null } | null }[] | null;
  };

  const out: InactiveClientRow[] = [];
  for (const c of (data ?? []) as unknown as Row[]) {
    const subs = c.subscriptions ?? [];
    const hasActive = subs.some((s) => effectiveStatus(s.status, s.start_date, s.end_date, today) === "active");
    if (hasActive || subs.length === 0) continue; // only previously-subscribed, now-inactive clients
    const latest = subs.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    out.push({
      id: `inact-${c.id}`,
      clientId: c.id,
      fullName: c.full_name,
      phone: c.phone ?? "",
      age: ageFrom(c.birth_date),
      gender: c.gender === "female" ? "Female" : "Male",
      birthDate: c.birth_date ?? "",
      lastSubscription: latest.end_date,
      group: latest.plan?.group?.name ?? latest.plan?.name ?? "—",
      subscriptionType: "class_subscription",
    });
  }
  return out;
}

// ── Birthdays ─────────────────────────────────────────────────────────────────
export async function getBirthdays(): Promise<BirthdayRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone, birth_date")
    .eq("gym_id", profile.gymId)
    .neq("status", "archived")
    .not("birth_date", "is", null);
  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  const year = new Date().getFullYear();
  return ((data ?? []) as { id: string; full_name: string; phone: string | null; birth_date: string }[]).map((c) => ({
    id: `bd-${c.id}`,
    clientId: c.id,
    fullName: c.full_name,
    phone: c.phone ?? "",
    age: ageFrom(c.birth_date),
    birthDate: c.birth_date,
    date: `${year}-${c.birth_date.slice(5, 10)}`,
  }));
}

// ── Finance documents (server-side filtered / sorted / paginated) ──────────────
export type FinanceDocsParams = {
  search?: string;
  /** doc_type enum values to include. undefined/null = all; [] = none. */
  docTypes?: string[] | null;
  from?: string | null; // "YYYY-MM-DD"
  to?: string | null;
  sort?: string; // column key: fullName | docType | docNumber | date | sum | initiatedBy
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type FinanceDocsResult = {
  rows: FinanceDocument[];
  total: number;
  cards: { receipts: number; withoutVat: number; withVat: number; grandTotal: number };
};

/**
 * Finance documents for one page. Filtering, sorting, the page slice, the total
 * count and the summary-card sums are all computed in Postgres by the
 * report_finance_documents() RPC (migration 00008) — the whole table never
 * leaves the database. doc_type enum → display label happens here.
 */
export async function getFinanceDocuments(params: FinanceDocsParams = {}): Promise<FinanceDocsResult> {
  const { supabase } = await getAuthedProfile();
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const page = Math.max(1, params.page ?? 1);

  const { data, error } = await supabase.rpc("report_finance_documents", {
    p_search: params.search ?? "",
    p_doc_types: params.docTypes ?? null,
    p_from: params.from || null,
    p_to: params.to || null,
    p_sort: params.sort ?? "date",
    p_dir: params.dir === "asc" ? "asc" : "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`Failed to load finance documents: ${error.message}`);

  const res = (data ?? {}) as {
    total?: number;
    cards?: { receipts?: number; withoutVat?: number; withVat?: number; grandTotal?: number };
    rows?: RawDocRow[];
  };
  return {
    rows: (res.rows ?? []).map((d) => ({
      id: d.id,
      clientId: d.clientId ?? "",
      fullName: d.fullName ?? "—",
      docType: DOC_TYPE_LABELS[d.docType] ?? d.docType,
      docNumber: d.docNumber ?? "0",
      date: d.date,
      sum: Number(d.sum),
      initiatedBy: d.initiatedBy ?? "—",
    })),
    total: Number(res.total ?? 0),
    cards: {
      receipts: Number(res.cards?.receipts ?? 0),
      withoutVat: Number(res.cards?.withoutVat ?? 0),
      withVat: Number(res.cards?.withVat ?? 0),
      grandTotal: Number(res.cards?.grandTotal ?? 0),
    },
  };
}
type RawDocRow = {
  id: string;
  clientId: string | null;
  fullName: string | null;
  docType: string;
  docNumber: string | null;
  date: string;
  sum: number;
  initiatedBy: string | null;
};

// ── Finance payments (server-side filtered / sorted / paginated) ───────────────
export type FinancePaymentsParams = {
  search?: string;
  /** UI method keys to include. undefined/null = all; [] = none. */
  methods?: PaymentMethod[] | null;
  from?: string | null;
  to?: string | null;
  sort?: string; // fullName | method | docType | docNumber | date | sum
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type FinancePaymentsResult = {
  rows: FinancePayment[];
  total: number;
  cards: { cash: number; creditCard: number; cheques: number; bankTransfer: number; grandTotal: number };
};

/** UI method key → the payment_method enum value(s) it covers. */
const UI_METHOD_TO_DB: Record<PaymentMethod, string[]> = {
  cash: ["cash"],
  creditCard: ["credit_card"],
  cheques: ["cheque"],
  bankTransfer: ["bank_transfer", "direct_debit"],
};

/**
 * Finance payments for one page. Filtering, sorting, the page slice, the total
 * count and the per-method card sums are computed in Postgres by the
 * report_finance_payments() RPC (migration 00009) — the payments table never
 * leaves the database.
 */
export async function getFinancePayments(params: FinancePaymentsParams = {}): Promise<FinancePaymentsResult> {
  const { supabase } = await getAuthedProfile();
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const page = Math.max(1, params.page ?? 1);
  const dbMethods = params.methods == null ? null : params.methods.flatMap((m) => UI_METHOD_TO_DB[m] ?? []);

  const { data, error } = await supabase.rpc("report_finance_payments", {
    p_search: params.search ?? "",
    p_methods: dbMethods,
    p_from: params.from || null,
    p_to: params.to || null,
    p_sort: params.sort ?? "date",
    p_dir: params.dir === "asc" ? "asc" : "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`Failed to load payments: ${error.message}`);

  const res = (data ?? {}) as {
    total?: number;
    cards?: { cash?: number; creditCard?: number; cheques?: number; bankTransfer?: number; grandTotal?: number };
    rows?: RawPayRow[];
  };
  return {
    rows: (res.rows ?? []).map((p) => ({
      id: p.id,
      clientId: p.clientId ?? "",
      fullName: p.fullName ?? "—",
      method: PAYMENT_METHOD_MAP[p.method] ?? "cash",
      docType: p.docType ? DOC_TYPE_LABELS[p.docType] ?? p.docType : "Informal",
      docNumber: p.docNumber ?? "0",
      date: p.date,
      sum: Number(p.sum),
    })),
    total: Number(res.total ?? 0),
    cards: {
      cash: Number(res.cards?.cash ?? 0),
      creditCard: Number(res.cards?.creditCard ?? 0),
      cheques: Number(res.cards?.cheques ?? 0),
      bankTransfer: Number(res.cards?.bankTransfer ?? 0),
      grandTotal: Number(res.cards?.grandTotal ?? 0),
    },
  };
}
type RawPayRow = {
  id: string;
  clientId: string | null;
  fullName: string | null;
  method: string;
  docType: string | null;
  docNumber: string | null;
  date: string;
  sum: number;
};

// ── Finance charges (outstanding balance = invoiced − paid, per client) ─────────
// Aggregation runs entirely in Postgres via the report_finance_charges() RPC
// (Σ invoiced − Σ paid, grouped per client, returning only clients in debt).
// Scales to 100k+ documents/payments — no full-table fetch into Node.
// See supabase/migrations/00003_production_polish.sql.
type FinanceChargeRow = {
  client_id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: string | null;
  balance: number;
  last_date: string | null;
};
export async function getFinanceCharges(): Promise<FinanceCharge[]> {
  const { supabase } = await getAuthedProfile();
  const today = todayISO();

  const { data, error } = await supabase.rpc("report_finance_charges");
  if (error) throw new Error(`Failed to load finance charges: ${error.message}`);

  return ((data ?? []) as FinanceChargeRow[]).map((c) => ({
    id: `chg-${c.client_id}`,
    clientId: c.client_id,
    fullName: c.full_name,
    memberId: c.national_id ?? "",
    age: ageFrom(c.birth_date),
    phone: c.phone ?? "",
    date: c.last_date ?? today,
    balance: Number(c.balance),
    gender: c.gender ?? "other",
  }));
}

// ── Credit-card transactions ─────────────────────────────────────────────────
export async function getCreditCardTransactions(): Promise<CreditCardTxn[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, paid_at, card_last4, gateway_txn_id, status, original_txn_id, client:clients(id, full_name), creator:profiles(full_name)")
    .eq("gym_id", profile.gymId)
    .eq("method", "credit_card")
    .order("paid_at", { ascending: false });
  if (error) throw new Error(`Failed to load credit-card transactions: ${error.message}`);

  const statusLabel = (s: string | null): CreditCardTxn["status"] => {
    if (s === "refunded") return "Refunded";
    if (s === "declined" || s === "failed") return "Declined";
    return "Approved";
  };

  return ((data ?? []) as unknown as CcRow[]).map((t) => ({
    id: t.id,
    date: t.paid_at.replace("T", " ").slice(0, 16),
    clientId: t.client?.id ?? "",
    clientName: t.client?.full_name ?? "—",
    transactionId: t.gateway_txn_id ?? t.id,
    amount: Number(t.amount),
    last4: t.card_last4 ?? "----",
    status: statusLabel(t.status),
    originalTxn: t.original_txn_id ?? "—",
    initiatedBy: t.creator?.full_name ?? "—",
  }));
}
type CcRow = {
  id: string;
  amount: number;
  paid_at: string;
  card_last4: string | null;
  gateway_txn_id: string | null;
  status: string | null;
  original_txn_id: string | null;
  client: { id: string; full_name: string } | null;
  creator: { full_name: string } | null;
};

// ── Orders (server-side filtered / sorted / paginated) ─────────────────────────
export type OrdersParams = {
  search?: string;
  status?: string; // all | completed | pending | cancelled
  from?: string | null;
  to?: string | null;
  sort?: string; // orderNumber | status | date | clientName | price
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type OrdersResult = { rows: Order[]; total: number; grandTotal: number };

const ORDER_STATUS_DB_TO_UI: Record<string, OrderStatus> = {
  completed: "completed",
  paid: "completed",
  pending: "pending",
  cancelled: "cancelled",
  canceled: "cancelled",
};

/**
 * Orders for one page. Filtering, sorting, the page slice, the total count and
 * the grand total run in Postgres via report_finance_orders() (migration 00010).
 */
export async function getOrders(params: OrdersParams = {}): Promise<OrdersResult> {
  const { supabase } = await getAuthedProfile();
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const page = Math.max(1, params.page ?? 1);

  const { data, error } = await supabase.rpc("report_finance_orders", {
    p_search: params.search ?? "",
    p_status: params.status ?? "all",
    p_from: params.from || null,
    p_to: params.to || null,
    p_sort: params.sort ?? "date",
    p_dir: params.dir === "asc" ? "asc" : "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`Failed to load orders: ${error.message}`);

  const res = (data ?? {}) as { total?: number; grandTotal?: number; rows?: RawOrderRow[] };
  return {
    rows: (res.rows ?? []).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: ORDER_STATUS_DB_TO_UI[o.status] ?? "pending",
      date: o.date,
      clientId: o.clientId ?? "",
      clientName: o.clientName ?? "—",
      price: Number(o.price),
    })),
    total: Number(res.total ?? 0),
    grandTotal: Number(res.grandTotal ?? 0),
  };
}
type RawOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  date: string;
  clientId: string | null;
  clientName: string | null;
  price: number;
};

// ── Sold items (packages / products) — server-side filtered/sorted/paginated ──
export type SoldItemsParams = {
  kind: "plan" | "product";
  search?: string;
  item?: string | null; // item name; null/"" = all
  byUser?: string | null; // order creator full_name; null/"" = all
  from?: string | null;
  to?: string | null;
  sort?: string; // name | price | date | fullName | byUser
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type SoldItemsResult = { rows: SoldItem[]; total: number; grandTotal: number };

/**
 * Sold packages/products for one page. Filtering, sorting, the page slice, the
 * total count and the grand total run in Postgres via report_sold_items()
 * (migration 00012) — order_items never leaves the database.
 */
export async function getSoldItems(params: SoldItemsParams): Promise<SoldItemsResult> {
  const { supabase } = await getAuthedProfile();
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const page = Math.max(1, params.page ?? 1);

  const { data, error } = await supabase.rpc("report_sold_items", {
    p_kind: params.kind,
    p_search: params.search ?? "",
    p_item: params.item ?? "",
    p_by_user: params.byUser ?? "",
    p_from: params.from || null,
    p_to: params.to || null,
    p_sort: params.sort ?? "date",
    p_dir: params.dir === "asc" ? "asc" : "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`Failed to load sold items: ${error.message}`);

  const res = (data ?? {}) as { total?: number; grandTotal?: number; rows?: RawSoldRow[] };
  return {
    rows: (res.rows ?? []).map((s) => ({
      id: s.id,
      name: s.name ?? "—",
      price: Number(s.price),
      date: s.date ?? "",
      clientId: s.clientId ?? "",
      fullName: s.fullName ?? "—",
      byUser: s.byUser ?? "—",
    })),
    total: Number(res.total ?? 0),
    grandTotal: Number(res.grandTotal ?? 0),
  };
}
type RawSoldRow = {
  id: string;
  name: string | null;
  price: number;
  date: string | null;
  clientId: string | null;
  fullName: string | null;
  byUser: string | null;
};

// ── Leads (per campaign) ─────────────────────────────────────────────────────
export async function getLeads(): Promise<LeadRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, phone, gender, created_at, converted_client_id, campaign:campaigns(name, platform_type, campaign_type)")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load leads: ${error.message}`);

  return ((data ?? []) as unknown as LeadDbRow[]).map((l) => ({
    id: l.id,
    date: l.created_at.slice(0, 10),
    clientId: l.converted_client_id ?? "",
    fullName: l.full_name,
    phone: l.phone ?? "",
    campaign: l.campaign?.name ?? "—",
    platform: l.campaign?.platform_type ?? "—",
    campaignType: l.campaign?.campaign_type ?? "—",
    gender: l.gender ?? "other",
  }));
}
type LeadDbRow = {
  id: string;
  full_name: string;
  phone: string | null;
  gender: string | null;
  created_at: string;
  converted_client_id: string | null;
  campaign: { name: string; platform_type: string; campaign_type: string } | null;
};

// ── Messages (one row per sent message) ──────────────────────────────────────
export async function getMessages(): Promise<MessageRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("messages")
    .select("id, channel, content, sent_at, created_at, client:clients(id, full_name, phone)")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load messages: ${error.message}`);

  return ((data ?? []) as unknown as MsgRow[]).map((m) => ({
    id: m.id,
    type: m.channel === "app" ? "App Notification" : "SMS",
    date: (m.sent_at ?? m.created_at).replace("T", " ").slice(0, 19),
    content: m.content,
    recipients: m.client ? [{ id: m.client.id, clientId: m.client.id, fullName: m.client.full_name, phone: m.client.phone ?? "" }] : [],
  }));
}
type MsgRow = {
  id: string;
  channel: string;
  content: string;
  sent_at: string | null;
  created_at: string;
  client: { id: string; full_name: string; phone: string | null } | null;
};

// ── Employee presence (staff shifts) ─────────────────────────────────────────
export async function getEmployeePresence(): Promise<Shift[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("staff_shifts")
    .select("id, trainer_id, started_at, ended_at, hourly_rate, status, trainer:trainers(full_name)")
    .eq("gym_id", profile.gymId)
    .order("started_at", { ascending: false });
  if (error) throw new Error(`Failed to load shifts: ${error.message}`);

  return ((data ?? []) as unknown as ShiftRow[]).map((s) => {
    const startMs = new Date(s.started_at).getTime();
    const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const duration = Math.max(0, Math.round(((endMs - startMs) / 3_600_000) * 100) / 100);
    return {
      id: s.id,
      employeeId: s.trainer_id,
      employeeName: s.trainer?.full_name ?? "—",
      start: s.started_at.replace("T", " ").slice(0, 16),
      end: s.ended_at ? s.ended_at.replace("T", " ").slice(0, 16) : "—",
      hourlyRate: Number(s.hourly_rate),
      duration,
      total: Math.round(duration * Number(s.hourly_rate) * 100) / 100,
      status: s.status === "completed" ? "completed" : "active",
    };
  });
}
type ShiftRow = {
  id: string;
  trainer_id: string;
  started_at: string;
  ended_at: string | null;
  hourly_rate: number;
  status: string;
  trainer: { full_name: string } | null;
};

// ── Trainer hours (sessions a trainer ran) ───────────────────────────────────
export async function getTrainerHours(): Promise<TrainerHourRow[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, end_time, status, class:classes(name, hourly_rate, kind:class_kinds(name))")
    .eq("gym_id", profile.gymId)
    .order("session_date", { ascending: false });
  if (error) throw new Error(`Failed to load sessions: ${error.message}`);

  const sessions = (data ?? []) as unknown as TrainerSessionRow[];
  const ids = sessions.map((s) => s.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: enr } = await supabase
      .from("class_enrollments")
      .select("session_id")
      .eq("gym_id", profile.gymId)
      .in("session_id", ids)
      .in("status", ["booked", "attended"]);
    for (const e of (enr ?? []) as { session_id: string }[]) counts.set(e.session_id, (counts.get(e.session_id) ?? 0) + 1);
  }

  const hours = (from: string, to: string) => {
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    let mins = th * 60 + tm - (fh * 60 + fm);
    if (mins < 0) mins += 24 * 60; // crosses midnight
    return Math.round((mins / 60) * 100) / 100;
  };

  return sessions.map((s) => {
    const [y, m, d] = s.session_date.split("-").map(Number);
    return {
      id: s.id,
      className: s.class?.name ?? s.class?.kind?.name ?? "—",
      date: s.session_date,
      weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()],
      fromHour: s.start_time.slice(0, 5),
      toHour: s.end_time.slice(0, 5),
      enrollments: counts.get(s.id) ?? 0,
      duration: hours(s.start_time, s.end_time),
      classRate: Number(s.class?.hourly_rate ?? 0),
      canceled: s.status === "canceled",
    };
  });
}
type TrainerSessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  class: { name: string | null; hourly_rate: number; kind: { name: string } | null } | null;
};

// ── Trainer / employee option lists ──────────────────────────────────────────
async function fetchTrainers(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  const { data, error } = await supabase
    .from("trainers")
    .select("id, full_name")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(`Failed to load trainers: ${error.message}`);
  return ((data ?? []) as { id: string; full_name: string }[]).map((t) => ({ id: t.id, name: t.full_name }));
}

/** Plain trainer list (Trainer Hours filter). */
export async function getReportTrainers(): Promise<IdName[]> {
  const { supabase, profile } = await getAuthedProfile();
  return fetchTrainers(supabase, profile.gymId);
}

/** Trainers with an "All" prefix (Sold Items filter). */
export async function getSoldItemsTrainerOptions(): Promise<IdName[]> {
  const { supabase, profile } = await getAuthedProfile();
  return [{ id: "all", name: "All" }, ...(await fetchTrainers(supabase, profile.gymId))];
}

/** Employees with an "All" prefix (Employee Presence filter). */
export async function getEmployeeOptions(): Promise<IdName[]> {
  const { supabase, profile } = await getAuthedProfile();
  return [{ id: "all", name: "All" }, ...(await fetchTrainers(supabase, profile.gymId))];
}

// ── Sold-item filter options (real catalogs, not hardcoded) ──────────────────
type FilterOption = { value: string; label: string };

/** Distinct package names for the Sold Packages filter — the gym's real plans.
 * Values match the sold rows' `name` (plan name) so the filter actually filters. */
export async function getSoldPackageOptions(): Promise<FilterOption[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("name")
    .eq("gym_id", profile.gymId)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load package options: ${error.message}`);
  const names = [...new Set(((data ?? []) as { name: string }[]).map((p) => p.name))];
  return [{ value: "all", label: "All packages" }, ...names.map((n) => ({ value: n, label: n }))];
}

/** Distinct product names for the Sold Products filter — the gym's real products. */
export async function getSoldProductOptions(): Promise<FilterOption[]> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("gym_id", profile.gymId)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load product options: ${error.message}`);
  const names = [...new Set(((data ?? []) as { name: string }[]).map((p) => p.name))];
  return [{ value: "all", label: "All products" }, ...names.map((n) => ({ value: n, label: n }))];
}
