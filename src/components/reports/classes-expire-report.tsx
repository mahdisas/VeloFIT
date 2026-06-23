"use client";

import * as React from "react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { SubscriptionReportTable } from "@/components/reports/subscription-report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/provider";
import {
  GENDER_OPTIONS,
  PERIOD_OPTIONS,
  periodRange,
  SUBSCRIBERS_WHO_OPTIONS,
  type SubscriptionRow,
  type SubscriptionsData,
  SUBSCRIPTION_TYPE_OPTIONS,
} from "@/lib/reports/subscriptions";

export function ClassesExpireReport({ data }: { data: SubscriptionsData }) {
  const t = useT();
  const [subType, setSubType] = React.useState("all");
  const [gender, setGender] = React.useState("all");
  const [group, setGroup] = React.useState("all");
  const [subscribersWho, setSubscribersWho] = React.useState("start");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [period, setPeriod] = React.useState("all");
  const [showLast, setShowLast] = React.useState(false);

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const rows = React.useMemo(() => {
    const range = periodRange(period);
    let result = data.rows.filter((r) => {
      if (subType !== "all" && r.status !== subType) return false;
      if (gender !== "all" && r.gender !== gender) return false;
      if (group !== "all" && r.group !== group) return false;
      if (range && (r.startDate < range[0] || r.startDate > range[1])) return false;
      // "Subscribers who" picks which date the From/To range applies to.
      const field = subscribersWho === "end" ? r.expireDate : r.startDate;
      if (fromDate && field < fromDate) return false;
      if (toDate && field > toDate) return false;
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
  }, [data.rows, subType, gender, group, subscribersWho, fromDate, toDate, period, showLast]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Subscription type" value={subType} onChange={setSubType} options={SUBSCRIPTION_TYPE_OPTIONS} className="w-full sm:w-52" />
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-44" />
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groupOptions} className="w-full sm:w-44" />
          <FilterSelect label="Subscribers who" value={subscribersWho} onChange={setSubscribersWho} options={SUBSCRIBERS_WHO_OPTIONS} className="w-full sm:w-60" />
          <FilterField label="From date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </FilterField>
          <FilterField label="To date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </FilterField>
          <FilterSelect label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} className="w-full sm:w-52" />
          <label className="flex items-center gap-2 text-sm">
            {t("Show just the last subscription")}
            <Switch checked={showLast} onCheckedChange={setShowLast} />
          </label>
        </div>

        <SubscriptionReportTable rows={rows} filename="classes-expire-report.csv" />
      </CardContent>
    </Card>
  );
}
