"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate, initials } from "@/lib/reports/format";
import { type InactiveClientRow } from "@/lib/reports/inactive-clients";
import { GENDER_OPTIONS } from "@/lib/reports/subscriptions";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function InactiveClientsReport({ rows: all }: { rows: InactiveClientRow[] }) {
  const [gender, setGender] = React.useState("all");
  const [from, setFrom] = React.useState("2026-04-15");
  const [to, setTo] = React.useState("2026-06-15");

  const rows = React.useMemo(
    () => all.filter((r) => (gender === "all" || r.gender.toLowerCase() === gender) && inRange(r.lastSubscription, from, to)),
    [all, gender, from, to]
  );

  const columns: Column<InactiveClientRow>[] = [
    { key: "image", header: "Image", value: () => "", cell: (r) => <Avatar className="size-9"><AvatarFallback className="bg-sky-100 text-xs font-medium text-sky-700"><span dir="auto">{initials(r.fullName)}</span></AvatarFallback></Avatar> },
    { key: "fullName", header: "Full Name", value: (r) => r.fullName, cell: (r) => <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link> },
    { key: "phone", header: "Phone Number", value: (r) => r.phone },
    { key: "age", header: "Age", value: (r) => r.age },
    { key: "gender", header: "Gender", value: (r) => r.gender },
    { key: "birthDate", header: "Birth Date", value: (r) => r.birthDate, cell: (r) => fmtDate(r.birthDate) },
    { key: "lastSubscription", header: "Last Subscription", value: (r) => r.lastSubscription, cell: (r) => fmtDate(r.lastSubscription) },
    { key: "group", header: "Group", value: (r) => r.group, cell: (r) => <span dir="auto">{r.group}</span> },
    { key: "subscriptionType", header: "Subscription Type", value: (r) => r.subscriptionType },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-44" />
          <FilterField label="From date" className="w-full sm:w-52"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-52"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
        <ReportDataTable rows={rows} columns={columns} filename="inactive-clients-report.csv" selectable />
      </CardContent>
    </Card>
  );
}
