"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDateTime } from "@/lib/reports/format";
import { MESSAGE_TYPE_OPTIONS, type MessageRecipient, type MessageRow } from "@/lib/reports/messages-report";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function MessagesReportView({ rows: all }: { rows: MessageRow[] }) {
  const t = useT();
  const [from, setFrom] = React.useState("2026-06-08");
  const [to, setTo] = React.useState("2026-06-15");
  const [type, setType] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (m) =>
        inRange(m.date, from, to) &&
        (type === "all" || m.type === type) &&
        (!q || [m.type, fmtDateTime(m.date), m.content].join(" ").toLowerCase().includes(q))
    );
  }, [all, from, to, type, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const getExportData = () => ({
    filename: "messages-report.csv",
    header: ["Type", "Date", "Content", "Recipient", "Phone"],
    rows: filtered.flatMap((m) => m.recipients.map((r) => [m.type, fmtDateTime(m.date), m.content, r.fullName, r.phone])),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-52"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-52"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
          <FilterSelect label="Type" value={type} onChange={setType} options={MESSAGE_TYPE_OPTIONS} className="w-full sm:w-44" />
        </div>

        <ReportToolbar query={query} onQueryChange={(v) => { setQuery(v); setPage(1); }} getExportData={getExportData} />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10" />
                <TableHead className="font-medium text-muted-foreground">{t("Type")}</TableHead>
                <TableHead className="font-medium text-muted-foreground">{t("Date")}</TableHead>
                <TableHead className="font-medium text-muted-foreground">{t("Content")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{t("No data available in the table")}</TableCell></TableRow>
              ) : (
                paged.map((m) => (
                  <React.Fragment key={m.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(m.id)}>
                      <TableCell><ChevronRight className={cn("size-4 text-muted-foreground transition-transform", expanded.has(m.id) && "rotate-90")} /></TableCell>
                      <TableCell>{t(m.type)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDateTime(m.date)}</TableCell>
                      <TableCell><span dir="auto">{m.content}</span></TableCell>
                    </TableRow>
                    {expanded.has(m.id) && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="bg-muted/20 p-4">
                          <RecipientsTable recipients={m.recipients} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TablePager page={safePage} pageSize={pageSize} totalRows={filtered.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </CardContent>
    </Card>
  );
}

function RecipientsTable({ recipients }: { recipients: MessageRecipient[] }) {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const pageCount = Math.max(1, Math.ceil(recipients.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = recipients.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-muted-foreground">{t("Full Name")}</TableHead>
            <TableHead className="font-medium text-muted-foreground">{t("Phone Number")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link></TableCell>
              <TableCell className="text-muted-foreground">{r.phone}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager page={safePage} pageSize={pageSize} totalRows={recipients.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
    </div>
  );
}
