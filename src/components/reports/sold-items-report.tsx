"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { exportSoldItems } from "@/app/(app)/reports/actions";
import { FilterField, FilterSelect, type FilterOption } from "@/components/reports/filter-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { type SoldItem } from "@/lib/reports/sold-items";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type SoldItemsReportParams = {
  kind: "plan" | "product";
  search: string;
  item: string; // item name; "" = all
  byUser: string; // creator name; "" = all
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

/**
 * Sold Packages / Products report — TRUE server-side filtering, sorting and
 * pagination. The item filter (by name) and the "By User" filter (the order
 * creator's name) write to the URL; the server re-runs report_sold_items.
 */
export function SoldItemsReport({
  rows,
  total,
  grandTotal,
  params,
  itemLabel,
  itemOptions,
  trainerOptions,
  filename,
  emptyHint,
}: {
  rows: SoldItem[];
  total: number;
  grandTotal: number;
  params: SoldItemsReportParams;
  itemLabel: string; // "Packages" | "Products"
  itemOptions: FilterOption[];
  trainerOptions: IdName[];
  filename: string;
  emptyHint?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  // "By User" filter options use the creator name as the value (the report
  // matches the order creator's name), with an "All" sentinel.
  const trainerSelectOptions = React.useMemo(
    () => trainerOptions.map((tr) => ({ value: tr.id === "all" ? "all" : tr.name, label: tr.name })),
    [trainerOptions]
  );

  const current: Record<string, string> = {};
  if (params.search) current.q = params.search;
  if (params.item) current.item = params.item;
  if (params.byUser) current.trainer = params.byUser;
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

  const toggleSort = (key: string) =>
    navigate({ sort: key, dir: params.sort === key && params.dir === "asc" ? "desc" : "asc" });

  const columns: { key: string; header: string }[] = [
    { key: "name", header: "Name" },
    { key: "price", header: "Price" },
    { key: "date", header: "Date" },
    { key: "fullName", header: "Full Name" },
    { key: "byUser", header: "By User" },
  ];

  const text = (s: SoldItem, key: string): string | number => {
    switch (key) {
      case "name": return s.name;
      case "price": return s.price;
      case "date": return s.date;
      case "fullName": return s.fullName;
      case "byUser": return s.byUser;
      default: return "";
    }
  };
  const cell = (s: SoldItem, key: string): React.ReactNode => {
    switch (key) {
      case "name": return <span dir="auto">{s.name}</span>;
      case "price": return money(s.price);
      case "date": return fmtDate(s.date);
      case "fullName": return <Link href={`/clients/${s.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{s.fullName}</Link>;
      case "byUser": return <span dir="auto">{s.byUser}</span>;
      default: return null;
    }
  };

  const exportCsv = () => {
    startTransition(async () => {
      const all = await exportSoldItems({
        kind: params.kind,
        search: params.search,
        item: params.item || null,
        byUser: params.byUser || null,
        from: params.from || null,
        to: params.to || null,
        sort: params.sort,
        dir: params.dir,
      });
      const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
      const csv = [
        columns.map((c) => esc(c.header)).join(","),
        ...all.map((s) => columns.map((c) => esc(text(s, c.key))).join(",")),
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
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col">
            <FilterSelect label={itemLabel} value={params.item || "all"} onChange={(v) => navigate({ item: v === "all" ? null : v })} options={itemOptions} className="w-full sm:w-52" />
            {emptyHint && (
              <span className="mt-1 px-1 text-xs text-destructive">{t("No groups found.")} <span className="cursor-pointer underline">{t("Create here")}</span></span>
            )}
          </div>
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={params.from} onChange={(e) => navigate({ from: e.target.value || null })} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={params.to} onChange={(e) => navigate({ to: e.target.value || null })} /></FilterField>
          <FilterSelect label="Trainer" value={params.byUser || "all"} onChange={(v) => navigate({ trainer: v === "all" ? null : v })} options={trainerSelectOptions} className="w-full sm:w-52" />
        </div>

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
                rows.map((s) => (
                  <TableRow key={s.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>{cell(s, c.key)}</TableCell>
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
                      {c.key === "price" ? `${t("TOTAL")}: ${money(grandTotal)}` : ""}
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
