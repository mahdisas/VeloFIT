/**
 * Credit Card Transactions types. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (reads the credit-card payments ledger).
 */

export type CreditCardTxn = {
  id: string;
  date: string; // yyyy-mm-dd HH:MM
  clientId: string;
  clientName: string;
  transactionId: string;
  amount: number;
  last4: string;
  status: "Approved" | "Declined" | "Refunded";
  originalTxn: string;
  initiatedBy: string;
};
