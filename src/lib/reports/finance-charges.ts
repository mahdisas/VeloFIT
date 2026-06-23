/**
 * Finance charges types — clients carrying an outstanding balance. Real,
 * RLS-scoped data is fetched in lib/reports/server.ts (Σ invoiced − Σ paid).
 */

export type FinanceCharge = {
  id: string;
  clientId: string;
  fullName: string;
  memberId: string;
  age: number;
  phone: string;
  date: string;
  balance: number;
  gender: string;
};
