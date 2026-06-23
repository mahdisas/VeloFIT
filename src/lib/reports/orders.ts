/**
 * Orders report types + status meta/options. Real, RLS-scoped data is fetched
 * in lib/reports/server.ts (the orders table joined to clients).
 */

export type OrderStatus = "completed" | "pending" | "cancelled";

export const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: "green" | "amber" | "red" }> = {
  completed: { label: "Completed", tone: "green" },
  pending: { label: "Pending", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  date: string;
  clientId: string;
  clientName: string;
  price: number;
};
