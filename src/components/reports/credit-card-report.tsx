"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { StatusPill, type PillTone } from "@/components/reports/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type CreditCardTxn } from "@/lib/reports/credit-card";
import { fmtDateTime, money } from "@/lib/reports/format";

const TONE: Record<CreditCardTxn["status"], PillTone> = { Approved: "green", Declined: "red", Refunded: "amber" };

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function CreditCardReport({ txns }: { txns: CreditCardTxn[] }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const rows = React.useMemo(() => txns.filter((t) => inRange(t.date, from, to)), [txns, from, to]);

  const columns: Column<CreditCardTxn>[] = [
    { key: "date", header: "Date", value: (t) => t.date, cell: (t) => fmtDateTime(t.date) },
    { key: "clientName", header: "Client Name", value: (t) => t.clientName, cell: (t) => <Link href={`/clients/${t.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{t.clientName}</Link> },
    { key: "transactionId", header: "Transaction Id", value: (t) => t.transactionId },
    { key: "amount", header: "Amount", value: (t) => t.amount, cell: (t) => money(t.amount) },
    { key: "last4", header: "Last 4 Digits", value: (t) => t.last4 },
    { key: "status", header: "Status", value: (t) => t.status, cell: (t) => <StatusPill tone={TONE[t.status]} label={t.status} /> },
    { key: "originalTxn", header: "Original Transaction Number", value: (t) => t.originalTxn },
    { key: "initiatedBy", header: "Initiated By", value: (t) => t.initiatedBy },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
        <ReportDataTable rows={rows} columns={columns} filename="credit-card-transactions.csv" />
      </CardContent>
    </Card>
  );
}
