"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

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

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Show a (decorative) sort caret on the header, matching the reference. */
  sortable?: boolean;
  className?: string;
  headClassName?: string;
};

/**
 * The bordered card + table + pager used by every client-profile tab.
 * Owns its own pagination; tab-specific chrome goes in `toolbar`.
 */
export function ProfileTablePanel<T extends { id: string }>({
  toolbar,
  columns,
  rows,
  emptyText,
  maxBodyHeight,
}: {
  toolbar?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  /** When set (px), only the table scrolls vertically; the header stays pinned. */
  maxBodyHeight?: number;
}) {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

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
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headClassName}>
                  <span className="flex items-center gap-1 font-medium text-muted-foreground">
                    {col.header}
                    {col.sortable && <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />}
                  </span>
                </TableHead>
              ))}
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
        totalRows={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
}
