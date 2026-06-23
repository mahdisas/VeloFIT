"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { ReportToolbar } from "@/components/reports/report-toolbar";
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
import { money } from "@/lib/reports/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number; // drives sort / search / export
  cell?: (row: T) => React.ReactNode; // optional custom render
  align?: "right";
};

/**
 * Generic, column-driven report table: search, sortable columns, optional row
 * selection, an optional money TOTAL footer, pagination and CSV/Excel/Print
 * export. Every report (regardless of its columns) feeds it `columns` + `rows`.
 */
export function ReportDataTable<T extends { id: string }>({
  rows,
  columns,
  filename,
  selectable = false,
  totalColumnKey,
  totalFormat = money,
  emptyText,
}: {
  rows: T[];
  columns: Column<T>[];
  filename: string;
  selectable?: boolean;
  /** When set, render a TOTAL footer summing this column. */
  totalColumnKey?: string;
  /** How to format the TOTAL value (defaults to money). */
  totalFormat?: (n: number) => string;
  emptyText?: string;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" }>({ key: columns[0]?.key ?? "", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => setPage(1), [rows]);

  const searched = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.map((c) => c.value(r)).join(" ").toLowerCase().includes(q));
  }, [rows, query, columns]);

  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    if (!col) return searched;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [searched, sort, columns]);

  const total = React.useMemo(() => {
    if (!totalColumnKey) return 0;
    const col = columns.find((c) => c.key === totalColumnKey);
    return col ? searched.reduce((sum, r) => sum + Number(col.value(r) || 0), 0) : 0;
  }, [searched, totalColumnKey, columns]);

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
    header: columns.map((c) => c.header),
    rows: sorted.map((r) => columns.map((c) => c.value(r))),
  });

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <ReportToolbar query={query} onQueryChange={(v) => { setQuery(v); setPage(1); }} getExportData={getExportData} />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox checked={pageSelected} onCheckedChange={toggleAll} aria-label={t("Select all")} />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key} className={cn(col.align === "right" && "text-end")}>
                  <button type="button" onClick={() => toggleSort(col.key)} className={cn("flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground", col.align === "right" && "ms-auto")}>
                    {t(col.header)}
                    <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">{emptyText ?? t("No data available in the table")}</TableCell>
              </TableRow>
            ) : (
              paged.map((r) => (
                <TableRow key={r.id}>
                  {selectable && (
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={t("Select row")} />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.align === "right" && "text-end")}>
                      {col.cell ? col.cell(r) : col.value(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {totalColumnKey && paged.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30">
                {columns.map((col, i) => (
                  <td key={col.key} className="px-3 py-3 text-sm font-semibold whitespace-nowrap" colSpan={i === 0 && selectable ? 2 : 1}>
                    {col.key === totalColumnKey ? `${t("TOTAL")}: ${totalFormat(total)}` : ""}
                  </td>
                ))}
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
