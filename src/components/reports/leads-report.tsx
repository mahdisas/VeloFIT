"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { useMultiCheckboxFilter } from "@/components/reports/finance-filters";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/reports/format";
import { CAMPAIGN_TYPE_OPTIONS, type LeadRow, PLATFORM_OPTIONS } from "@/lib/reports/leads-report";
import { GENDER_OPTIONS } from "@/lib/reports/subscriptions";
import { useT } from "@/lib/i18n/provider";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function LeadsReport({ rows: all }: { rows: LeadRow[] }) {
  const t = useT();
  const [from, setFrom] = React.useState("2026-06-01");
  const [to, setTo] = React.useState("2026-06-30");
  const [gender, setGender] = React.useState("all");
  const platform = useMultiCheckboxFilter("Platform Type", PLATFORM_OPTIONS, "sm:w-52");
  const campaignType = useMultiCheckboxFilter("Campaign Type", CAMPAIGN_TYPE_OPTIONS, "sm:w-52");

  const rows = React.useMemo(
    () =>
      all.filter(
        (r) =>
          inRange(r.date, from, to) &&
          platform.matches(r.platform) &&
          campaignType.matches(r.campaignType) &&
          (gender === "all" || r.gender === gender)
      ),
    [all, from, to, platform.matches, campaignType.matches, gender]
  );

  const columns: Column<LeadRow>[] = [
    { key: "date", header: "Date", value: (r) => r.date, cell: (r) => fmtDate(r.date) },
    { key: "fullName", header: "Full Name", value: (r) => r.fullName, cell: (r) => <Link href={`/clients/${r.clientId}`} dir="auto" className="font-medium text-primary hover:underline">{r.fullName}</Link> },
    { key: "phone", header: "Phone Number", value: (r) => r.phone },
    { key: "campaign", header: "Campaign", value: (r) => r.campaign },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
          {platform.node}
          {campaignType.node}
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-44" />
        </div>
        <h3 className="font-semibold">{t("Details")}</h3>
        <ReportDataTable rows={rows} columns={columns} filename="leads-per-campaign.csv" />
      </CardContent>
    </Card>
  );
}
