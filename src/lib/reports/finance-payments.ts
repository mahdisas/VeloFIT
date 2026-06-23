/**
 * Finance payment types + method legend. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (the payments ledger joined to documents).
 */

export type PaymentMethod = "cash" | "creditCard" | "cheques" | "bankTransfer";

export const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Total cash" },
  { key: "creditCard", label: "Total credit card" },
  { key: "cheques", label: "Total cheques" },
  { key: "bankTransfer", label: "Total bank transfer" },
];

export type FinancePayment = {
  id: string;
  clientId: string;
  fullName: string;
  method: PaymentMethod;
  docType: string;
  docNumber: string;
  date: string; // yyyy-mm-dd HH:MM:SS
  sum: number;
};
