"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isNoExpiry } from "@/lib/clients";
import { type SubscriptionRow } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = keyof Pick<SubscriptionRow, "fullName" | "status" | "startDate" | "endDate">;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "status", label: "Status" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "Expire Date" },
];

const STATUS_VARIANT: Record<SubscriptionRow["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  frozen: "bg-sky-100 text-sky-700",
  expired: "bg-rose-100 text-rose-700",
  canceled: "bg-slate-100 text-slate-600",
};

/**
 * Bottom-row table used by both "Subscriptions About To Expire" and
 * "...Recently Added". Header carets sort client-side, matching the reference's
 * sortable columns.
 */
export function SubscriptionsTable({
  title,
  subtitle = "Classes Subscriptions",
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: SubscriptionRow[];
}) {
  const t = useT();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "endDate",
    dir: "asc",
  });

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (a, b) => a[sort.key].localeCompare(b[sort.key]) * factor
    );
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <p className="border-b px-4 py-3 text-sm font-semibold">{t(subtitle)}</p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t(col.label)}
                      <ChevronsUpDown
                        className={cn(
                          "size-3.5",
                          sort.key === col.key ? "text-foreground" : "text-muted-foreground/50"
                        )}
                      />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
                    {t("No subscriptions to show.")}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.clientId ? (
                        <Link
                          href={`/clients/${row.clientId}`}
                          dir="auto"
                          className="font-medium text-primary hover:underline"
                        >
                          {row.fullName}
                        </Link>
                      ) : (
                        <span dir="auto" className="font-medium">{row.fullName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", STATUS_VARIANT[row.status])}>
                        {t(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.startDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {isNoExpiry(row.endDate) ? t("No Expiration") : formatDate(row.endDate)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
