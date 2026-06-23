"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";

/**
 * Shared table footer used across the Clients feature: "Row per page",
 * "Go to", "Total rows" and a first/prev/page/next/last pager. Controlled.
 */
export function TablePager({
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const t = useT();
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const clamp = (p: number) => Math.min(Math.max(1, p), pageCount);

  return (
    <div className="flex flex-col items-center gap-3 px-1 py-3 text-sm text-muted-foreground sm:flex-row">
      <div className="flex items-center gap-2">
        <span>{t("Row per page")}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger size="sm" className="w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span>{t("Go to")}</span>
        <Input
          type="number"
          min={1}
          max={pageCount}
          value={page}
          onChange={(e) => onPageChange(clamp(Number(e.target.value) || 1))}
          className="h-8 w-16"
        />
      </div>

      <span>{t("Total rows:")} {totalRows}</span>

      <div className="flex items-center gap-1 sm:ms-auto">
        <PagerButton label={t("First page")} disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="size-4 rtl:rotate-180" />
        </PagerButton>
        <PagerButton label={t("Previous page")} disabled={page <= 1} onClick={() => onPageChange(clamp(page - 1))}>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </PagerButton>

        {/* Numbered pages (windowed with ellipsis on large counts) */}
        {pageItems(page, pageCount).map((item, i) =>
          item === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 select-none text-muted-foreground">…</span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? "default" : "outline"}
              size="icon"
              className="size-8 text-xs font-medium"
              aria-label={t("Page {n}", { n: item })}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          )
        )}

        <PagerButton label={t("Next page")} disabled={page >= pageCount} onClick={() => onPageChange(clamp(page + 1))}>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </PagerButton>
        <PagerButton label={t("Last page")} disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}>
          <ChevronsRight className="size-4 rtl:rotate-180" />
        </PagerButton>
      </div>
    </div>
  );
}

/**
 * Page numbers to render. Shows all when ≤7 pages; otherwise the first, last,
 * and a 3-wide window around the current page, with "…" gaps.
 */
function pageItems(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push("…");
  items.push(pageCount);
  return items;
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
