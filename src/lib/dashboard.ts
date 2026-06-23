/**
 * Dashboard — client-safe types, colors, and formatters.
 *
 * The real, RLS-scoped aggregates are computed server-side in
 * lib/dashboard-server.ts (getDashboardData). This module stays free of any DB
 * import so the chart/table components can share its types and helpers.
 *
 * Shapes mirror the schema: subscriptions, subscription_plans, class_groups,
 * attendances, accounting_documents, payments.
 */

// ApexCharts default palette — the reference dashboard uses these exact hues.
export const CHART_COLORS = {
  blue: "#008FFB",
  green: "#00E396",
  orange: "#FEB019",
  red: "#FF4560",
  purple: "#775DD0",
  lightBlue: "#69b8ff",
  yellow: "#fbbf24",
} as const;

export type SparkPoint = { value: number };

/** ₪ — the reference gym bills in ILS. Driven by gym.settings.currency later. */
export function formatCurrency(amount: number, currency = "ILS"): string {
  const symbol = currency === "ILS" ? "₪" : "$";
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Row 1 — top metric cards
export type DashboardMetrics = {
  activeSubscriptions: number;
  todayEntrances: number;
  totalDebits: number;
  totalReceipts: number;
  totalInvoices: number;
  /** Trailing sparkline series, one per card. */
  sparklines: {
    activeSubscriptions: SparkPoint[];
    todayEntrances: SparkPoint[];
    totalDebits: SparkPoint[];
    totalReceipts: SparkPoint[];
    totalInvoices: SparkPoint[];
  };
};

// Row 2a — Revenue 6 Months (Receipts vs Invoices)
export type RevenuePoint = { month: string; receipts: number; invoices: number };

// Donuts — a labelled slice list reused by "By Group" and "By Period"
export type DonutSlice = { label: string; value: number; color: string };

// Row 3a — Subscriptions 6 Months (Renewals vs Expirations)
export type SubscriptionFlowPoint = {
  month: string;
  renewals: number;
  expirations: number;
};

// Row 4 — bottom tables
export type SubscriptionRow = {
  id: string;
  clientId: string; // links the name to the client profile
  fullName: string;
  status: "active" | "frozen" | "expired" | "pending" | "canceled";
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
};
