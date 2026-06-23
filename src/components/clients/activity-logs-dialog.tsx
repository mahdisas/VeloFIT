"use client";

import * as React from "react";
import { ChevronDown, ChevronsUpDown } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ActivityLog } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const COLUMNS = ["Date", "Action", "Item", "Name", "Initiated By"];

function fmt(iso: string): string {
  const d = new Date(iso);
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${date}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/** Read-only audit trail of changes to this client. */
export function ActivityLogsDialog({
  logs,
  children,
}: {
  logs: ActivityLog[];
  children: React.ReactNode;
}) {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = logs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("Activity Logs")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8" />
                {COLUMNS.map((c) => (
                  <TableHead key={c}>
                    <span className="flex items-center gap-1 font-medium text-muted-foreground">
                      {t(c)} <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((log) => {
                const canExpand = log.action === "Update";
                const isOpen = expanded.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <TableRow>
                      <TableCell className="align-top">
                        {canExpand && (
                          <button
                            type="button"
                            aria-label={isOpen ? t("Collapse") : t("Expand")}
                            onClick={() => toggle(log.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(log.date)}</TableCell>
                      <TableCell>{t(log.action)}</TableCell>
                      <TableCell>{t(log.item)}</TableCell>
                      <TableCell><span dir="auto">{log.name}</span></TableCell>
                      <TableCell className="text-muted-foreground">{log.initiatedBy}</TableCell>
                    </TableRow>
                    {canExpand && isOpen && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={COLUMNS.length} className="text-sm text-muted-foreground">
                          {t("Updated")} <span dir="auto" className="font-medium text-foreground">{log.name}</span> {t("— field changes recorded by {by}.", { by: log.initiatedBy })}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <TablePager
          page={safePage}
          pageSize={pageSize}
          totalRows={logs.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
        </div>
      </SheetContent>
    </Sheet>
  );
}
