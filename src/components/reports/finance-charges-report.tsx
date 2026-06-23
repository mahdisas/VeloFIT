"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate, money } from "@/lib/reports/format";
import { type FinanceCharge } from "@/lib/reports/finance-charges";
import { GENDER_OPTIONS } from "@/lib/reports/subscriptions";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function FinanceChargesReport({ charges }: { charges: FinanceCharge[] }) {
  const [gender, setGender] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const rows = React.useMemo(
    () => charges.filter((c) => (gender === "all" || c.gender === gender) && inRange(c.date, from, to)),
    [charges, gender, from, to]
  );

  const columns: Column<FinanceCharge>[] = [
    { key: "fullName", header: "Full Name", value: (c) => c.fullName, cell: (c) => <Link href={`/clients/${c.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{c.fullName}</Link> },
    { key: "memberId", header: "ID", value: (c) => c.memberId },
    { key: "age", header: "Age", value: (c) => c.age },
    { key: "phone", header: "Phone Number", value: (c) => c.phone },
    { key: "date", header: "Date", value: (c) => c.date, cell: (c) => fmtDate(c.date) },
    { key: "balance", header: "Balance", value: (c) => c.balance, cell: (c) => money(c.balance) },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-44" />
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
        <ReportDataTable rows={rows} columns={columns} filename="finance-charges-report.csv" selectable totalColumnKey="balance" />
      </CardContent>
    </Card>
  );
}
