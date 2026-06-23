"use client";

import * as React from "react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { SubscriptionReportTable } from "@/components/reports/subscription-report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DURATION_PERIOD_OPTIONS,
  GENDER_OPTIONS,
  monthsBetween,
  type SubscriptionsData,
} from "@/lib/reports/subscriptions";

export function NoEnrollmentsReport({ data }: { data: SubscriptionsData }) {
  const [gender, setGender] = React.useState("all");
  const [group, setGroup] = React.useState("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [duration, setDuration] = React.useState("all");

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const rows = React.useMemo(() => {
    return data.rows.filter((r) => {
      if (gender !== "all" && r.gender !== gender) return false;
      if (group !== "all" && r.group !== group) return false;
      if (duration !== "all" && monthsBetween(r.startDate, r.expireDate) !== Number(duration)) return false;
      // From/To define the no-enrollment window: keep subscriptions active during it.
      if (fromDate && r.expireDate < fromDate) return false;
      if (toDate && r.startDate > toDate) return false;
      return true;
    });
  }, [data.rows, gender, group, fromDate, toDate, duration]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} className="w-full sm:w-44" />
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groupOptions} className="w-full sm:w-44" />
          <FilterField label="From date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </FilterField>
          <FilterField label="To date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </FilterField>
          <FilterSelect label="Period" value={duration} onChange={setDuration} options={DURATION_PERIOD_OPTIONS} className="w-full sm:w-52" />
        </div>

        <SubscriptionReportTable rows={rows} filename="subscriptions-with-no-enrollments.csv" />
      </CardContent>
    </Card>
  );
}
