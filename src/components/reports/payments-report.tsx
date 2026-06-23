"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { exportFinancePayments } from "@/app/(app)/reports/actions";
import { PaymentCards } from "@/components/reports/finance-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

/** Method filter options (URL carries the UI key; label is shown). */
const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "creditCard", label: "Credit Card" },
  { value: "cheques", label: "Cheques" },
  { value: "bankTransfer", label: "Bank Transfer" },
];
const METHOD_LABEL = Object.fromEntries(METHOD_OPTIONS.map((o) => [o.value, o.label])) as Record<PaymentMethod, string>;

export type PaymentsReportParams = {
  search: string;
  methods: PaymentMethod[] | null; // null = all methods
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

type Cards = { cash: number; creditCard: number; cheques: number; bankTransfer: number; grandTotal: number };

/**
 * Finance payments report — TRUE server-side filtering, sorting and pagination.
 * Controls write to the URL; the server re-runs report_finance_payments and
 * streams one page + totals + per-method card sums. No browser-side filtering.
 */
export function PaymentsReport({
  rows,
  total,
  cards,
  params,
  filename,
}: {
  rows: FinancePayment[];
  total: number;
  cards: Cards;
  params: PaymentsReportParams;
  filename: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  const current: Record<string, string> = {};
  if (params.search) current.q = params.search;
  if (params.methods) current.methods = params.methods.join(",");
  if (params.from) current.from = params.from;
  if (params.to) current.to = params.to;
  if (params.sort !== "date") current.sort = params.sort;
  if (params.dir !== "desc") current.dir = params.dir;
  if (params.page !== 1) current.page = String(params.page);
  if (params.pageSize !== 10) current.size = String(params.pageSize);

  const navigate = React.useCallback(
    (patch: Record<string, string | null>) => {
      const merged: Record<string, string | null> = { ...current, ...patch };
      if (!("page" in patch)) delete merged.page;
      const next = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(current), pathname, router]
  );

  const [search, setSearch] = React.useState(params.search);
  React.useEffect(() => setSearch(params.search), [params.search]);
  React.useEffect(() => {
    if (search === params.search) return;
    const id = setTimeout(() => navigate({ q: search || null }), 400);
    return () => clearTimeout(id);
  }, [search, params.search, navigate]);

  const allMethods = params.methods === null;
  const isChecked = (v: PaymentMethod) => allMethods || params.methods!.includes(v);
  const toggleMethod = (v: PaymentMethod) => {
    const base = allMethods ? METHOD_OPTIONS.map((o) => o.value) : params.methods!;
    const arr = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    navigate({ methods: arr.length === METHOD_OPTIONS.length ? null : arr.join(",") });
  };

  const toggleSort = (key: string) =>
    navigate({ sort: key, dir: params.sort === key && params.dir === "asc" ? "desc" : "asc" });

  const columns: { key: string; header: string }[] = [
    { key: "fullName", header: "Full Name" },
    { key: "method", header: "Payment Method" },
    { key: "docType", header: "Document Type" },
    { key: "docNumber", header: "Document Number" },
    { key: "date", header: "Date" },
    { key: "sum", header: "Sum" },
  ];

  const text = (p: FinancePayment, key: string): string | number => {
    switch (key) {
      case "fullName": return p.fullName;
      case "method": return METHOD_LABEL[p.method] ?? p.method;
      case "docType": return p.docType;
      case "docNumber": return p.docNumber;
      case "date": return p.date;
      case "sum": return p.sum;
      default: return "";
    }
  };
  const cell = (p: FinancePayment, key: string): React.ReactNode => {
    switch (key) {
      case "fullName":
        return <Link href={`/clients/${p.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{p.fullName}</Link>;
      case "method": return t(METHOD_LABEL[p.method] ?? p.method);
      case "docType": return <span dir="auto">{t(p.docType)}</span>;
      case "date": return fmtDateTime(p.date);
      case "sum": return money(p.sum);
      default: return p.docNumber;
    }
  };

  const exportCsv = () => {
    startTransition(async () => {
      const all = await exportFinancePayments({
        search: params.search,
        methods: params.methods,
        from: params.from || null,
        to: params.to || null,
        sort: params.sort,
        dir: params.dir,
      });
      const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
      const csv = [
        columns.map((c) => esc(c.header)).join(","),
        ...all.map((p) => columns.map((c) => esc(text(p, c.key))).join(",")),
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Exported {filename}", { filename: `${filename}.csv` }));
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("From date")}</label>
              <Input type="date" value={params.from} onChange={(e) => navigate({ from: e.target.value || null })} className="w-44" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("To date")}</label>
              <Input type="date" value={params.to} onChange={(e) => navigate({ to: e.target.value || null })} className="w-44" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {METHOD_OPTIONS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={isChecked(o.value)} onCheckedChange={() => toggleMethod(o.value)} />
                {t(o.label)}
              </label>
            ))}
          </div>
        </div>

        <PaymentCards cash={cards.cash} creditCard={cards.creditCard} cheques={cards.cheques} bankTransfer={cards.bankTransfer} />

        <div className="flex flex-col items-end gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search in report data")} className="ps-9" />
          </div>
          <div className="flex items-center gap-1">
            <IconBtn label={t("Export to Excel")} onClick={exportCsv}><FileSpreadsheet className="size-4" /></IconBtn>
            <IconBtn label={t("Export to CSV")} onClick={exportCsv}><FileText className="size-4" /></IconBtn>
            <IconBtn label={t("Print")} onClick={() => window.print()}><Printer className="size-4" /></IconBtn>
          </div>
        </div>

        <div className={cn("overflow-x-auto transition-opacity", pending && "opacity-60")}>
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
                      {c.key === "sum" ? `${t("TOTAL")}: ${money(cards.grandTotal)}` : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </Table>
        </div>

        <TablePager
          page={params.page}
          pageSize={params.pageSize}
          totalRows={total}
          onPageChange={(p) => navigate({ page: p === 1 ? null : String(p) })}
          onPageSizeChange={(s) => navigate({ size: s === 10 ? null : String(s) })}
        />
      </CardContent>
    </Card>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} className="text-muted-foreground hover:text-foreground" onClick={onClick}>
      {children}
    </Button>
  );
}
