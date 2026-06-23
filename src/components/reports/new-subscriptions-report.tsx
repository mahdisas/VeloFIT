"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/reports/format";
import { type NewSubscriptionRow } from "@/lib/reports/new-subscriptions";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function NewSubscriptionsReport({ rows: all }: { rows: NewSubscriptionRow[] }) {
  const [from, setFrom] = React.useState("2026-04-15");
  const [to, setTo] = React.useState("2026-06-15");

  const rows = React.useMemo(() => all.filter((r) => inRange(r.joiningDate, from, to)), [all, from, to]);

  const columns: Column<NewSubscriptionRow>[] = [
    { key: "fullName", header: "Full Name", value: (r) => r.fullName, cell: (r) => <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link> },
    { key: "phone", header: "Phone Number", value: (r) => r.phone },
    { key: "group", header: "Group", value: (r) => r.group, cell: (r) => <span dir="auto">{r.group}</span> },
    { key: "joiningDate", header: "Joining Date", value: (r) => r.joiningDate, cell: (r) => fmtDate(r.joiningDate) },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-52"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-52"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
        <ReportDataTable rows={rows} columns={columns} filename="new-classes-subscriptions.csv" selectable />
      </CardContent>
    </Card>
  );
}
