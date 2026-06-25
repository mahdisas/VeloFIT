"use client";

import * as React from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Provide a value accessor to make this header click-to-sort. */
  sortValue?: (row: T) => string | number;
  /** Show a (decorative) sort caret when the column has no `sortValue`. */
  sortable?: boolean;
  className?: string;
  headClassName?: string;
};

/**
 * The bordered card + table + pager used by every client-profile tab. Owns its
 * own pagination and — for columns that supply a `sortValue` — click-to-sort on
 * the header (toggling asc/desc). Tab-specific chrome goes in `toolbar`.
 */
export function ProfileTablePanel<T extends { id: string }>({
  toolbar,
  columns,
  rows,
  emptyText,
  maxBodyHeight,
  defaultSort,
}: {
  toolbar?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  /** When set (px), only the table scrolls vertically; the header stays pinned. */
  maxBodyHeight?: number;
  /** Initial sort, e.g. newest-first: `{ key: "date", dir: "desc" }`. */
  defaultSort?: { key: string; dir: SortDir };
}) {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sort, setSort] = React.useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null);

  const sorted = React.useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const accessor = col.sortValue;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    setSort((prev) => (prev && prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      <div
        className={cn(
          "overflow-x-auto rounded-xl ring-1 ring-foreground/10",
          maxBodyHeight != null && "overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card"
        )}
        style={maxBodyHeight != null ? { maxHeight: maxBodyHeight } : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const dir = sort && sort.key === col.key ? sort.dir : null;
                return (
                  <TableHead key={col.key} className={col.headClassName}>
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "flex items-center gap-1 font-medium transition-colors hover:text-foreground",
                          dir ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {col.header}
                        {dir === "asc" ? (
                          <ChevronUp className="size-3.5" />
                        ) : dir === "desc" ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-muted-foreground">
                        {col.header}
                        {col.sortable && <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />}
                      </span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyText ?? t("No data available in the table")}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.className)}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePager
        page={safePage}
        pageSize={pageSize}
        totalRows={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
}
