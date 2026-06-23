"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import { ReportToolbar } from "@/components/reports/report-toolbar";
import { StatusPill } from "@/components/reports/status-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_META, type SubscriptionRow } from "@/lib/reports/subscriptions";
import { formatDate, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export const fmtDate = (iso: string): string => formatDate(iso);
export const money = formatMoney;

/** An extra column injected before the Cost column (e.g. Classes Enrolled). */
export type ExtraColumn = {
  key: string;
  label: string;
  value: (r: SubscriptionRow) => string | number; // drives sort / search / export
  cell?: (r: SubscriptionRow) => React.ReactNode; // optional custom render
};

type Col = {
  key: string;
  label: string;
  value: (r: SubscriptionRow) => string | number;
  cell: (r: SubscriptionRow) => React.ReactNode;
};

const BASE_COLUMNS: Col[] = [
  { key: "fullName", label: "Full Name", value: (r) => r.fullName, cell: (r) => (
    <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link>
  ) },
  { key: "memberId", label: "ID", value: (r) => r.memberId, cell: (r) => <span className="text-muted-foreground">{r.memberId}</span> },
  { key: "phone", label: "Phone Number", value: (r) => r.phone, cell: (r) => <span className="text-muted-foreground">{r.phone}</span> },
  { key: "group", label: "Group", value: (r) => r.group, cell: (r) => <span dir="auto" className="inline-block max-w-40 truncate align-middle">{r.group}</span> },
  { key: "status", label: "Status", value: (r) => STATUS_META[r.status].label, cell: (r) => <StatusPill tone={STATUS_META[r.status].tone} label={STATUS_META[r.status].label} /> },
  { key: "startDate", label: "Start Date", value: (r) => r.startDate, cell: (r) => <span className="text-muted-foreground">{fmtDate(r.startDate)}</span> },
  { key: "expireDate", label: "Expire Date", value: (r) => r.expireDate, cell: (r) => <span className="text-muted-foreground">{fmtDate(r.expireDate)}</span> },
];

const COST_COLUMN: Col = { key: "cost", label: "Cost", value: (r) => r.cost, cell: (r) => <span className="font-medium whitespace-nowrap">{money(r.cost)}</span> };

/**
 * Shared subscription report table: search, sortable/selectable columns, an
 * optional grand TOTAL footer, pagination and CSV/Excel/Print export. The parent
 * feeds it the already-filtered `rows`; `extraColumns` injects report-specific
 * columns (e.g. Classes Enrolled) between Expire Date and Cost.
 */
export function SubscriptionReportTable({
  rows,
  filename,
  showTotal = true,
  extraColumns = [],
}: {
  rows: SubscriptionRow[];
  filename: string;
  showTotal?: boolean;
  extraColumns?: ExtraColumn[];
}) {
  const t = useT();
  const columns = React.useMemo<Col[]>(() => {
    const extras = extraColumns.map((ec) => ({ key: ec.key, label: ec.label, value: ec.value, cell: ec.cell ?? ((r: SubscriptionRow) => String(ec.value(r))) }));
    return [...BASE_COLUMNS, ...extras, COST_COLUMN];
  }, [extraColumns]);

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" }>({ key: "fullName", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => setPage(1), [rows]);

  const searchText = React.useCallback(
    (r: SubscriptionRow) =>
      [r.fullName, r.memberId, r.phone, r.group, STATUS_META[r.status].label, fmtDate(r.startDate), fmtDate(r.expireDate), ...extraColumns.map((ec) => ec.value(r)), r.cost]
        .join(" ")
        .toLowerCase(),
    [extraColumns]
  );

  const searched = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => searchText(r).includes(q)) : rows;
  }, [rows, query, searchText]);

  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [searched, sort, columns]);

  const total = React.useMemo(() => searched.reduce((sum, r) => sum + r.cost, 0), [searched]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const pageSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageSelected) paged.forEach((r) => next.delete(r.id));
      else paged.forEach((r) => next.add(r.id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const getExportData = () => ({
    filename,
    header: columns.map((c) => c.label),
    rows: sorted.map((r) => columns.map((c) => c.value(r))),
  });

  return (
    <div className="flex flex-col gap-6">
      <ReportToolbar query={query} onQueryChange={(v) => { setQuery(v); setPage(1); }} getExportData={getExportData} />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox checked={pageSelected} onCheckedChange={toggleAll} aria-label={t("Select all")} />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  <button type="button" onClick={() => toggleSort(col.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                    {t(col.label)}
                    <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                  {t("No data available in the table")}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={t("Select {name}", { name: r.fullName })} />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.cell(r)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {showTotal && paged.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={columns.length} className="px-3 py-3 text-end text-sm font-semibold">{t("TOTAL")}:</td>
                <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap">{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      <TablePager
        page={safePage}
        pageSize={pageSize}
        totalRows={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
