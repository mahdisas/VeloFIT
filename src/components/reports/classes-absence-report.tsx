"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import { FilterSelect } from "@/components/reports/filter-select";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { StatusPill } from "@/components/reports/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ABSENCE_PERIOD_OPTIONS,
  type AbsenceData,
  type AbsenceRow,
  DURATION_PERIOD_OPTIONS,
} from "@/lib/reports/classes-absence";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "memberId" | "phone" | "group" | "startDate" | "expireDate" | "lastEntrance";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "memberId", label: "ID" },
  { key: "phone", label: "Phone Number" },
  { key: "group", label: "Group" },
  { key: "startDate", label: "Start Date" },
  { key: "expireDate", label: "Expire Date" },
  { key: "lastEntrance", label: "Last Entrance" },
];

const fmtDate = (iso: string | null) => formatDate(iso, "");

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""} ${parts[1]?.[0] ?? ""}`.trim();
}

/** Days from `iso` until today; null entrance counts as infinitely absent. */
function daysSince(iso: string | null, today: number): number {
  if (!iso) return Infinity;
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((today - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

export function ClassesAbsenceReport({ data }: { data: AbsenceData }) {
  const t = useT();
  const [group, setGroup] = React.useState("all");
  const [absence, setAbsence] = React.useState("3");
  const [duration, setDuration] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "fullName", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const filtered = React.useMemo(() => {
    const today = Date.now();
    const minDays = Number(absence);
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (group !== "all" && r.group !== group) return false;
      if (daysSince(r.lastEntrance, today) <= minDays) return false;
      if (duration !== "all" && r.durationMonths !== Number(duration)) return false;
      if (q && ![r.fullName, r.memberId, r.phone, r.group, fmtDate(r.startDate), fmtDate(r.expireDate), fmtDate(r.lastEntrance)].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.rows, group, absence, duration, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * factor);
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = () => setPage(1);
  const toggleSort = (key: SortKey) =>
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
    filename: "classes-absence-report.csv",
    header: ["Full Name", "ID", "Phone Number", "Group", "Status", "Start Date", "Expire Date", "Last Entrance"],
    rows: sorted.map((r: AbsenceRow) => [r.fullName, r.memberId, r.phone, r.group, "Active", fmtDate(r.startDate), fmtDate(r.expireDate), fmtDate(r.lastEntrance)]),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm font-medium">{t("This report is for subscribers who are active and absent by selected period.")}</p>

        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Group" value={group} onChange={(v) => { setGroup(v); resetPage(); }} options={groupOptions} className="w-full sm:w-56" />
          <FilterSelect label="Absence period" value={absence} onChange={(v) => { setAbsence(v); resetPage(); }} options={ABSENCE_PERIOD_OPTIONS} className="w-full sm:w-56" />
          <FilterSelect label="Period" value={duration} onChange={(v) => { setDuration(v); resetPage(); }} options={DURATION_PERIOD_OPTIONS} className="w-full sm:w-56" />
        </div>

        <ReportToolbar query={query} onQueryChange={(v) => { setQuery(v); resetPage(); }} getExportData={getExportData} />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={pageSelected} onCheckedChange={toggleAll} aria-label={t("Select all")} />
                </TableHead>
                <TableHead className="text-muted-foreground">{t("Image")}</TableHead>
                {COLUMNS.slice(0, 4).map((col) => (
                  <SortHead key={col.key} col={col} sort={sort} onClick={toggleSort} />
                ))}
                <TableHead className="text-muted-foreground">{t("Status")}</TableHead>
                {COLUMNS.slice(4).map((col) => (
                  <SortHead key={col.key} col={col} sort={sort} onClick={toggleSort} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 3} className="h-24 text-center text-muted-foreground">
                    {t("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.fullName}`} />
                    </TableCell>
                    <TableCell>
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-sky-100 text-xs font-medium text-sky-700">
                          <span dir="auto">{initials(r.fullName)}</span>
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">
                        {r.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.memberId}</TableCell>
                    <TableCell className="text-muted-foreground">{r.phone}</TableCell>
                    <TableCell><span dir="auto" className="inline-block max-w-40 truncate align-middle">{r.group}</span></TableCell>
                    <TableCell><StatusPill tone="green" label="Active" /></TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.expireDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.lastEntrance)}</TableCell>
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
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </CardContent>
    </Card>
  );
}

function SortHead({ col, sort, onClick }: { col: { key: SortKey; label: string }; sort: { key: SortKey; dir: "asc" | "desc" }; onClick: (k: SortKey) => void }) {
  const t = useT();
  return (
    <TableHead>
      <button type="button" onClick={() => onClick(col.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
        {t(col.label)}
        <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
      </button>
    </TableHead>
  );
}
