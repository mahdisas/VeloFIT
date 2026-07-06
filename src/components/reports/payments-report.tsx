"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronsUpDown } from "lucide-react";

import { PaymentCards, PeriodFilterControls } from "@/components/reports/finance-filters";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePager } from "@/components/ui/table-pager";
import { fmtDateTime, money } from "@/lib/reports/format";
import { type FinancePayment, type PaymentMethod } from "@/lib/reports/finance-payments";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Accordion sections, in card order (Cash first — the reading start in RTL). */
const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Total cash" },
  { key: "creditCard", label: "Total credit card" },
  { key: "cheques", label: "Total cheques" },
  { key: "bankTransfer", label: "Total bank transfer" },
];

export type PaymentsReportParams = {
  /** "month" (default: year+month selects) or "range" (from/to pickers). */
  mode: "month" | "range";
  from: string;
  to: string;
  /** Which method accordion is expanded (its rows are fetched server-side). */
  open: PaymentMethod | null;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

type Cards = { cash: number; creditCard: number; cheques: number; bankTransfer: number; grandTotal: number };

/**
 * Finance payments report ("דוח תקבולים") — reference layout: a period filter
 * (year+month by default), the four per-method summary cards, then one
 * accordion row per payment method. Expanding a method writes ?open=<method>
 * to the URL and the server streams back that method's rows (sorted/paginated
 * in Postgres); the card sums always cover ALL methods for the period.
 */
export function PaymentsReport({
  cards,
  openRows,
  openTotal,
  params,
}: {
  cards: Cards;
  openRows: FinancePayment[];
  openTotal: number;
  params: PaymentsReportParams;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  // Non-default params currently in the URL, rebuilt from props (so we never
  // need useSearchParams → no Suspense boundary required).
  const current: Record<string, string> = {};
  if (params.mode === "range") current.mode = "range";
  if (params.from) current.from = params.from;
  if (params.to) current.to = params.to;
  if (params.open) current.open = params.open;
  if (params.sort !== "date") current.sort = params.sort;
  if (params.dir !== "desc") current.dir = params.dir;
  if (params.page !== 1) current.page = String(params.page);
  if (params.pageSize !== 10) current.size = String(params.pageSize);

  const navigate = React.useCallback(
    (patch: Record<string, string | null>) => {
      const merged: Record<string, string | null> = { ...current, ...patch };
      // Any change other than paging returns to page 1.
      if (!("page" in patch)) delete merged.page;
      const next = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(current), pathname, router]
  );

  const toggleSort = (key: string) =>
    navigate({ sort: key, dir: params.sort === key && params.dir === "asc" ? "desc" : "asc" });

  const cardValue: Record<PaymentMethod, number> = {
    cash: cards.cash,
    creditCard: cards.creditCard,
    cheques: cards.cheques,
    bankTransfer: cards.bankTransfer,
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        {/* Period filter — stacked at the reading start (right in RTL). */}
        <PeriodFilterControls mode={params.mode} from={params.from} to={params.to} navigate={navigate} />

        <PaymentCards cash={cards.cash} creditCard={cards.creditCard} cheques={cards.cheques} bankTransfer={cards.bankTransfer} />

        {/* One accordion per payment method; the open one holds its table. */}
        <div className={cn("flex flex-col divide-y rounded-lg border transition-opacity", pending && "opacity-60")}>
          {METHODS.map((m) => {
            const isOpen = params.open === m.key;
            return (
              <div key={m.key}>
                <button
                  type="button"
                  onClick={() => navigate({ open: isOpen ? null : m.key })}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <span>
                    {t(m.label)} <span className="tabular-nums">{cardValue[m.key]}</span>
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-4 pb-4">
                    <MethodTable
                      rows={openRows}
                      total={openTotal}
                      grandTotal={cardValue[m.key]}
                      params={params}
                      toggleSort={toggleSort}
                      navigate={navigate}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** The expanded method's rows — server-sorted/paginated like every report table. */
function MethodTable({
  rows,
  total,
  grandTotal,
  params,
  toggleSort,
  navigate,
}: {
  rows: FinancePayment[];
  total: number;
  grandTotal: number;
  params: PaymentsReportParams;
  toggleSort: (key: string) => void;
  navigate: (patch: Record<string, string | null>) => void;
}) {
  const t = useT();

  // Method column dropped — every row in this section shares the method.
  const columns: { key: string; header: string }[] = [
    { key: "fullName", header: "Full Name" },
    { key: "docType", header: "Document Type" },
    { key: "docNumber", header: "Document Number" },
    { key: "date", header: "Date" },
    { key: "sum", header: "Sum" },
  ];

  const cell = (p: FinancePayment, key: string): React.ReactNode => {
    switch (key) {
      case "fullName":
        return <Link href={`/clients/${p.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{p.fullName}</Link>;
      case "docType": return <span dir="auto">{t(p.docType)}</span>;
      case "date": return fmtDateTime(p.date);
      case "sum": return money(p.sum);
      default: return p.docNumber;
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key}>
                <button type="button" onClick={() => toggleSort(c.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {t(c.header)}
                  <ChevronsUpDown className={cn("size-3.5", params.sort === c.key ? "text-foreground" : "text-muted-foreground/50")} />
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{t("No data available in the table")}</TableCell>
            </TableRow>
          ) : (
            rows.map((p) => (
              <TableRow key={p.id}>
                {columns.map((c) => (
                  <TableCell key={c.key}>{cell(p, c.key)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/30">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-3 text-sm font-semibold whitespace-nowrap">
                  {c.key === "sum" ? `${t("TOTAL")}: ${money(grandTotal)}` : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </Table>

      <TablePager
        page={params.page}
        pageSize={params.pageSize}
        totalRows={total}
        onPageChange={(p) => navigate({ page: p === 1 ? null : String(p) })}
        onPageSizeChange={(s) => navigate({ size: s === 10 ? null : String(s) })}
      />
    </div>
  );
}
