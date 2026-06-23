"use client";

import * as React from "react";

import { FilterSelect } from "@/components/reports/filter-select";
import { type ExtraColumn, SubscriptionReportTable } from "@/components/reports/subscription-report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  GENDER_OPTIONS,
  type SubscriptionRow,
  type SubscriptionsData,
  SUBSCRIPTION_TYPE_OPTIONS,
} from "@/lib/reports/subscriptions";
import { useT } from "@/lib/i18n/provider";

export function DirectDebitReport({ data }: { data: SubscriptionsData }) {
  const t = useT();
  const [gender, setGender] = React.useState("all");
  const [subType, setSubType] = React.useState("all");
  const [group, setGroup] = React.useState("all");
  const [showMonthly, setShowMonthly] = React.useState(true);
  const [showLast, setShowLast] = React.useState(false);

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const rows = React.useMemo(() => {
    let result = data.rows.filter((r) => {
      if (gender !== "all" && r.gender !== gender) return false;
      if (subType !== "all" && r.status !== subType) return false;
      if (group !== "all" && r.group !== group) return false;
      if (!showMonthly && r.isMonthly) return false;
      return true;
    });
    if (showLast) {
      const latest = new Map<string, SubscriptionRow>();
      for (const r of result) {
        const cur = latest.get(r.clientId);
        if (!cur || r.startDate > cur.startDate) latest.set(r.clientId, r);
      }
      result = [...latest.values()];
    }
    return result;
  }, [data.rows, gender, subType, group, showMonthly, showLast]);

  const extraColumns = React.useMemo<ExtraColumn[]>(
    () => [
      { key: "succeedPayments", label: "Succeed Payments", value: (r: SubscriptionRow) => r.succeedPayments ?? 0 },
      { key: "totalPayments", label: "Total Payments", value: (r: SubscriptionRow) => r.totalPayments ?? 0 },
    ],
    []
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-40" />
          <FilterSelect label="Subscription type" value={subType} onChange={setSubType} options={SUBSCRIPTION_TYPE_OPTIONS} className="w-full sm:w-52" />
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groupOptions} muted className="w-full sm:w-44" />
          <label className="flex max-w-44 items-center gap-2 text-sm">
            {t("Show renewal monthly subscriptions")}
            <Switch checked={showMonthly} onCheckedChange={setShowMonthly} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t("Show just the last subscription")}
            <Switch checked={showLast} onCheckedChange={setShowLast} />
          </label>
        </div>

        <SubscriptionReportTable rows={rows} filename="direct-debit-subscriptions.csv" extraColumns={extraColumns} />
      </CardContent>
    </Card>
  );
}
