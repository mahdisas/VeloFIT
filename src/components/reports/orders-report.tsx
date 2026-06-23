"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { exportOrders } from "@/app/(app)/reports/actions";
import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { StatusPill } from "@/components/reports/status-pill";
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
import { type Order, ORDER_STATUS_META, ORDER_STATUS_OPTIONS } from "@/lib/reports/orders";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type OrdersReportParams = {
  search: string;
  status: string; // all | completed | pending | cancelled
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

/**
 * Orders report — TRUE server-side filtering, sorting and pagination. Controls
 * write to the URL; the server re-runs report_finance_orders and streams one
 * page + total + grand total. No browser-side filtering.
 */
export function OrdersReport({
  rows,
  total,
  grandTotal,
  params,
}: {
  rows: Order[];
  total: number;
  grandTotal: number;
  params: OrdersReportParams;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  const current: Record<string, string> = {};
  if (params.search) current.q = params.search;
  if (params.status !== "all") current.status = params.status;
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
    { key: "orderNumber", header: "Order Number" },
    { key: "status", header: "Status" },
    { key: "date", header: "Date" },
    { key: "clientName", header: "Client Name" },
    { key: "price", header: "Price" },
  ];

  const text = (o: Order, key: string): string | number => {
    switch (key) {
      case "orderNumber": return o.orderNumber;
      case "status": return ORDER_STATUS_META[o.status].label;
      case "date": return o.date;
      case "clientName": return o.clientName;
      case "price": return o.price;
      default: return "";
    }
  };
  const cell = (o: Order, key: string): React.ReactNode => {
    switch (key) {
      case "status": return <StatusPill tone={ORDER_STATUS_META[o.status].tone} label={ORDER_STATUS_META[o.status].label} />;
      case "date": return fmtDate(o.date);
      case "clientName": return <Link href={`/clients/${o.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{o.clientName}</Link>;
      case "price": return money(o.price);
      default: return o.orderNumber;
    }
  };

  const exportCsv = () => {
    startTransition(async () => {
      const all = await exportOrders({
        search: params.search,
        status: params.status,
        from: params.from || null,
        to: params.to || null,
        sort: params.sort,
        dir: params.dir,
      });
      const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
      const csv = [
        columns.map((c) => esc(c.header)).join(","),
        ...all.map((o) => columns.map((c) => esc(text(o, c.key))).join(",")),
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders-report.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Exported {filename}", { filename: "orders-report.csv" }));
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Status" value={params.status} onChange={(v) => navigate({ status: v === "all" ? null : v })} options={ORDER_STATUS_OPTIONS} className="w-full sm:w-44" />
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={params.from} onChange={(e) => navigate({ from: e.target.value || null })} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={params.to} onChange={(e) => navigate({ to: e.target.value || null })} /></FilterField>
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
                rows.map((o) => (
                  <TableRow key={o.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>{cell(o, c.key)}</TableCell>
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
