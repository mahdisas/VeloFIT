/**
 * Finance document types + card aggregates. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (the accounting_documents ledger).
 */

export const DOCUMENT_TYPES = [
  "Tax Invoice",
  "Receipt",
  "Receipt tax invoice",
  "Refund",
  "Non Formal Transaction",
  "Informal",
  "Bid",
];

export type FinanceDocument = {
  id: string;
  clientId: string;
  fullName: string;
  docType: string;
  docNumber: string;
  date: string; // yyyy-mm-dd
  sum: number;
  initiatedBy: string;
};

/** Card aggregates over a set of documents (Informal counts toward none). */
export function documentCardTotals(docs: FinanceDocument[]) {
  const sumWhere = (types: string[]) => docs.filter((d) => types.includes(d.docType)).reduce((s, d) => s + d.sum, 0);
  return {
    receipts: sumWhere(["Receipt", "Receipt tax invoice"]),
    withoutVat: sumWhere(["Non Formal Transaction", "Bid", "Refund"]),
    withVat: sumWhere(["Tax Invoice", "Receipt tax invoice"]),
  };
}
