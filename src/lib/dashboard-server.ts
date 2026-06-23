import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import {
  CHART_COLORS,
  type DashboardMetrics,
  type DonutSlice,
  type RevenuePoint,
  type SparkPoint,
  type SubscriptionFlowPoint,
  type SubscriptionRow,
} from "@/lib/dashboard";

/**
 * Server-only dashboard aggregates. One auth gate, then everything the page
 * renders is computed from real, RLS-scoped rows (subscriptions, attendances,
 * accounting_documents, payments). Heavy grouping is done in JS since PostgREST
 * has no GROUP BY — fine at gym scale.
 */

const PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.red,
  CHART_COLORS.purple,
  CHART_COLORS.lightBlue,
  CHART_COLORS.yellow,
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" → "MM/YYYY". */
const monthKey = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const flatSpark = (value: number, n = 12): SparkPoint[] => Array.from({ length: n }, () => ({ value }));

type SubStatus = SubscriptionRow["status"];
function effectiveStatus(status: string, start: string, end: string): SubStatus {
  const today = isoDate(new Date());
  if (status === "active" && end < today) return "expired";
  if (status === "active" && start > today) return "pending";
  const known: SubStatus[] = ["active", "frozen", "expired", "pending", "canceled"];
  return (known as string[]).includes(status) ? (status as SubStatus) : "active";
}

const RECEIPT_TYPES = ["receipt", "receipt_tax_invoice"];
const INVOICE_TYPES = ["tax_invoice", "receipt_tax_invoice"];

export type DashboardData = {
  metrics: DashboardMetrics;
  revenue: RevenuePoint[];
  byGroup: DonutSlice[];
  flow: SubscriptionFlowPoint[];
  byPeriod: DonutSlice[];
  aboutToExpire: SubscriptionRow[];
  recentlyAdded: SubscriptionRow[];
};

type SubRow = {
  start_date: string;
  end_date: string;
  status: string;
  plan: { period_months: number; group: { name: string } | null } | null;
};
type SubTableRow = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  client: { id: string; full_name: string } | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;
  const now = new Date();
  const today = isoDate(now);

  // Trailing 6-month labels + window start.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${pad(d.getMonth() + 1)}/${d.getFullYear()}`);
  }
  const sixStart = isoDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));

  // 14-day attendance window (covers today's count + the entrances sparkline).
  const start14 = new Date(now);
  start14.setDate(start14.getDate() - 13);

  const [subsRes, attendRes, docsRes, paymentsRes, expiringRes, recentRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("start_date, end_date, status, plan:subscription_plans(period_months, group:class_groups(name))")
      .eq("gym_id", gymId),
    supabase
      .from("attendances")
      .select("checked_in_at")
      .eq("gym_id", gymId)
      .gte("checked_in_at", `${isoDate(start14)}T00:00:00`),
    supabase
      .from("accounting_documents")
      .select("doc_type, total, issued_on")
      .eq("gym_id", gymId)
      .gte("issued_on", sixStart),
    supabase.from("payments").select("amount").eq("gym_id", gymId).gte("paid_at", `${sixStart}T00:00:00`),
    supabase
      .from("subscriptions")
      .select("id, status, start_date, end_date, client:clients(id, full_name)")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .gte("end_date", today)
      .order("end_date", { ascending: true })
      .limit(8),
    supabase
      .from("subscriptions")
      .select("id, status, start_date, end_date, client:clients(id, full_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  for (const r of [subsRes, attendRes, docsRes, paymentsRes, expiringRes, recentRes]) {
    if (r.error) throw new Error(`Failed to load dashboard data: ${r.error.message}`);
  }

  const subs = (subsRes.data ?? []) as unknown as SubRow[];
  const activeSubs = subs.filter((s) => s.status === "active" && s.end_date >= today);

  // ── Attendances → today's count + 14-day sparkline ──────────────────────────
  const attendByDay = new Map<string, number>();
  for (const a of (attendRes.data ?? []) as { checked_in_at: string }[]) {
    const day = a.checked_in_at.slice(0, 10);
    attendByDay.set(day, (attendByDay.get(day) ?? 0) + 1);
  }
  const todayEntrances = attendByDay.get(today) ?? 0;
  const entrancesSpark: SparkPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    entrancesSpark.push({ value: attendByDay.get(isoDate(d)) ?? 0 });
  }

  // ── Finance: receipts/invoices from documents, debits from payments ─────────
  const docs = (docsRes.data ?? []) as { doc_type: string; total: number; issued_on: string }[];
  const totalReceipts = docs.filter((d) => RECEIPT_TYPES.includes(d.doc_type)).reduce((s, d) => s + Number(d.total), 0);
  const totalInvoices = docs.filter((d) => INVOICE_TYPES.includes(d.doc_type)).reduce((s, d) => s + Number(d.total), 0);
  const totalDebits = ((paymentsRes.data ?? []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);

  const metrics: DashboardMetrics = {
    activeSubscriptions: activeSubs.length,
    todayEntrances,
    totalDebits,
    totalReceipts,
    totalInvoices,
    sparklines: {
      activeSubscriptions: flatSpark(activeSubs.length),
      todayEntrances: entrancesSpark,
      totalDebits: flatSpark(totalDebits),
      totalReceipts: flatSpark(totalReceipts),
      totalInvoices: flatSpark(totalInvoices),
    },
  };

  // ── Revenue 6 months (receipts vs invoices) ─────────────────────────────────
  const revByMonth = new Map(months.map((m) => [m, { receipts: 0, invoices: 0 }]));
  for (const d of docs) {
    const bucket = revByMonth.get(monthKey(d.issued_on));
    if (!bucket) continue;
    if (RECEIPT_TYPES.includes(d.doc_type)) bucket.receipts += Number(d.total);
    if (INVOICE_TYPES.includes(d.doc_type)) bucket.invoices += Number(d.total);
  }
  const revenue: RevenuePoint[] = months.map((m) => ({ month: m, ...revByMonth.get(m)! }));

  // ── Active subscriptions by group + by period ───────────────────────────────
  const groupCounts = new Map<string, number>();
  const periodCounts = new Map<number, number>();
  for (const s of activeSubs) {
    const group = s.plan?.group?.name ?? "Ungrouped";
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    const period = s.plan?.period_months ?? 1;
    periodCounts.set(period, (periodCounts.get(period) ?? 0) + 1);
  }
  const byGroup: DonutSlice[] = [...groupCounts.entries()].map(([label, value], i) => ({
    label,
    value,
    color: PALETTE[i % PALETTE.length],
  }));
  const byPeriod: DonutSlice[] = [...periodCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, value], i) => ({ label: `${m} Month${m > 1 ? "s" : ""}`, value, color: PALETTE[i % PALETTE.length] }));

  // ── Subscriptions flow 6 months (starts vs ends per month) ──────────────────
  const flowByMonth = new Map(months.map((m) => [m, { renewals: 0, expirations: 0 }]));
  for (const s of subs) {
    const startBucket = flowByMonth.get(monthKey(s.start_date));
    if (startBucket) startBucket.renewals += 1;
    if (s.end_date) {
      const endBucket = flowByMonth.get(monthKey(s.end_date));
      if (endBucket) endBucket.expirations += 1;
    }
  }
  const flow: SubscriptionFlowPoint[] = months.map((m) => ({ month: m, ...flowByMonth.get(m)! }));

  // ── Bottom tables ───────────────────────────────────────────────────────────
  const mapRow = (r: SubTableRow): SubscriptionRow => ({
    id: r.id,
    clientId: r.client?.id ?? "",
    fullName: r.client?.full_name ?? "—",
    status: effectiveStatus(r.status, r.start_date, r.end_date),
    startDate: r.start_date,
    endDate: r.end_date,
  });
  const aboutToExpire = ((expiringRes.data ?? []) as unknown as SubTableRow[]).map(mapRow);
  const recentlyAdded = ((recentRes.data ?? []) as unknown as SubTableRow[]).map(mapRow);

  return { metrics, revenue, byGroup, flow, byPeriod, aboutToExpire, recentlyAdded };
}
