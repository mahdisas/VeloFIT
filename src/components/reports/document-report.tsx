"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { exportFinanceDocuments } from "@/app/(app)/reports/actions";
import { InvoiceCards } from "@/components/reports/finance-filters";
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
import { fmtDate, money } from "@/lib/reports/format";
import { type FinanceDocument } from "@/lib/reports/finance-documents";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Document-type filter options (URL carries the enum value; label is shown). */
const DOC_TYPE_OPTIONS = [
  { value: "tax_invoice", label: "Tax Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "receipt_tax_invoice", label: "Receipt tax invoice" },
  { value: "refund", label: "Refund" },
  { value: "non_formal_transaction", label: "Non Formal Transaction" },
  { value: "informal", label: "Informal" },
  { value: "bid", label: "Bid" },
];

/** Current report state, resolved from the URL by the server page. */
export type DocumentReportParams = {
  search: string;
  docTypes: string[] | null; // null = all types selected
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

type Cards = { receipts: number; withoutVat: number; withVat: number; grandTotal: number };

/**
 * Finance documents report — TRUE server-side filtering, sorting and pagination.
 * Every control writes its state to the URL; the server page re-runs the
 * report_finance_documents RPC and streams back one page + totals + card sums.
 * No rows are filtered or counted in the browser.
 */
export function DocumentReport({
  rows,
  total,
  cards,
  params,
  filename,
  showInitiatedBy = false,
}: {
  rows: FinanceDocument[];
  total: number;
  cards: Cards;
  params: DocumentReportParams;
  filename: string;
  showInitiatedBy?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  // Non-default params currently in the URL, rebuilt from props (so we never
  // need useSearchParams → no Suspense boundary required).
  const current: Record<string, string> = {};
  if (params.search) current.q = params.search;
  if (params.docTypes) current.types = params.docTypes.join(",");
  if (params.from) current.from = params.from;
  if (params.to) current.to = params.to;
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

  // Debounced search box.
  const [search, setSearch] = React.useState(params.search);
  React.useEffect(() => setSearch(params.search), [params.search]);
  React.useEffect(() => {
    if (search === params.search) return;
    const id = setTimeout(() => navigate({ q: search || null }), 400);
    return () => clearTimeout(id);
  }, [search, params.search, navigate]);

  const allTypes = params.docTypes === null;
  const isChecked = (v: string) => allTypes || params.docTypes!.includes(v);
  const toggleType = (v: string) => {
    const base = allTypes ? DOC_TYPE_OPTIONS.map((o) => o.value) : params.docTypes!;
    const arr = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    navigate({ types: arr.length === DOC_TYPE_OPTIONS.length ? null : arr.join(",") });
  };

  const toggleSort = (key: string) =>
    navigate({ sort: key, dir: params.sort === key && params.dir === "asc" ? "desc" : "asc" });

  const columns: { key: string; header: string }[] = [
    { key: "fullName", header: "Full Name" },
    { key: "docType", header: "Document Type" },
    { key: "docNumber", header: "Document Number" },
    { key: "date", header: "Date" },
    { key: "sum", header: "Sum" },
    ...(showInitiatedBy ? [{ key: "initiatedBy", header: "Initiated By" }] : []),
  ];

  const text = (d: FinanceDocument, key: string): string | number => {
    switch (key) {
      case "fullName": return d.fullName;
      case "docType": return d.docType;
      case "docNumber": return d.docNumber;
      case "date": return d.date;
      case "sum": return d.sum;
      case "initiatedBy": return d.initiatedBy;
      default: return "";
    }
  };
  const cell = (d: FinanceDocument, key: string): React.ReactNode => {
    switch (key) {
      case "fullName":
        return <Link href={`/clients/${d.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{d.fullName}</Link>;
      case "docType": return <span dir="auto">{t(d.docType)}</span>;
      case "date": return fmtDate(d.date);
      case "sum": return money(d.sum);
      case "initiatedBy": return <span dir="auto">{d.initiatedBy}</span>;
      default: return d.docNumber;
    }
  };

  const exportCsv = () => {
    startTransition(async () => {
      const all = await exportFinanceDocuments({
        search: params.search,
        docTypes: params.docTypes,
        from: params.from || null,
        to: params.to || null,
        sort: params.sort,
        dir: params.dir,
      });
      const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
      const csv = [
        columns.map((c) => esc(c.header)).join(","),
        ...all.map((d) => columns.map((c) => esc(text(d, c.key))).join(",")),
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Exported {filename}", { filename }));
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        {/* Filters (server-side) */}
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
            {DOC_TYPE_OPTIONS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={isChecked(o.value)} onCheckedChange={() => toggleType(o.value)} />
                {t(o.label)}
              </label>
            ))}
          </div>
        </div>

        <InvoiceCards receipts={cards.receipts} withoutVat={cards.withoutVat} withVat={cards.withVat} />

        {/* Search + export */}
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

        {/* Table */}
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
                rows.map((d) => (
                  <TableRow key={d.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>{cell(d, c.key)}</TableCell>
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
