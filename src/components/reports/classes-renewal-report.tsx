"use client";

import * as React from "react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { SubscriptionReportTable } from "@/components/reports/subscription-report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RENEWAL_STATUS_OPTIONS } from "@/lib/reports/classes-renewal";
import {
  PERIOD_OPTIONS,
  periodRange,
  SUBSCRIBERS_WHO_OPTIONS,
  type SubscriptionsData,
} from "@/lib/reports/subscriptions";

export function ClassesRenewalReport({ data }: { data: SubscriptionsData }) {
  const [period, setPeriod] = React.useState("all");
  const [group, setGroup] = React.useState("all");
  const [subscribersWho, setSubscribersWho] = React.useState("end");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [renewalStatus, setRenewalStatus] = React.useState("non-renewal");

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const rows = React.useMemo(() => {
    const range = periodRange(period);
    return data.rows.filter((r) => {
      if (renewalStatus === "renewal" ? !r.isRenewal : r.isRenewal) return false;
      if (group !== "all" && r.group !== group) return false;
      if (range && (r.startDate < range[0] || r.startDate > range[1])) return false;
      const field = subscribersWho === "start" ? r.startDate : r.expireDate;
      if (fromDate && field < fromDate) return false;
      if (toDate && field > toDate) return false;
      return true;
    });
  }, [data.rows, period, group, subscribersWho, fromDate, toDate, renewalStatus]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} className="w-full sm:w-52" />
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groupOptions} className="w-full sm:w-44" />
          <FilterSelect label="Subscribers who" value={subscribersWho} onChange={setSubscribersWho} options={SUBSCRIBERS_WHO_OPTIONS} className="w-full sm:w-60" />
          <FilterField label="From date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </FilterField>
          <FilterField label="To date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </FilterField>
          <FilterSelect label="Renewal status" value={renewalStatus} onChange={setRenewalStatus} options={RENEWAL_STATUS_OPTIONS} className="w-full sm:w-96" />
        </div>

        <SubscriptionReportTable rows={rows} filename="classes-renewal-report.csv" showTotal={false} />
      </CardContent>
    </Card>
  );
}
