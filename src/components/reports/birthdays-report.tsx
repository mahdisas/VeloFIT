"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate, initials } from "@/lib/reports/format";
import { type BirthdayRow } from "@/lib/reports/birthdays";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function BirthdaysReport({ rows: all }: { rows: BirthdayRow[] }) {
  const [from, setFrom] = React.useState("2026-06-01");
  const [to, setTo] = React.useState("2026-06-30");

  const rows = React.useMemo(() => all.filter((r) => inRange(r.date, from, to)), [all, from, to]);

  const columns: Column<BirthdayRow>[] = [
    { key: "image", header: "Image", value: () => "", cell: (r) => <Avatar className="size-9"><AvatarFallback className="bg-sky-100 text-xs font-medium text-sky-700"><span dir="auto">{initials(r.fullName)}</span></AvatarFallback></Avatar> },
    { key: "fullName", header: "Full Name", value: (r) => r.fullName, cell: (r) => <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link> },
    { key: "phone", header: "Phone Number", value: (r) => r.phone },
    { key: "age", header: "Age", value: (r) => r.age },
    { key: "birthDate", header: "Birth Date", value: (r) => r.birthDate, cell: (r) => fmtDate(r.birthDate) },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-52"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-52"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
        <ReportDataTable rows={rows} columns={columns} filename="birthdays-report.csv" selectable />
      </CardContent>
    </Card>
  );
}
