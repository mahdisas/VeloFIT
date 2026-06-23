"use client";

import * as React from "react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { type ExtraColumn, SubscriptionReportTable } from "@/components/reports/subscription-report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type SubscriptionRow, type SubscriptionsData } from "@/lib/reports/subscriptions";
import { useT } from "@/lib/i18n/provider";

type Limit = { on: boolean; val: number };
type LimitKey = "perDay" | "perWeek" | "perMonth" | "entire";

const LIMIT_FIELDS: { key: LimitKey; label: string }[] = [
  { key: "perDay", label: "Maximum classes per day" },
  { key: "perWeek", label: "Maximum enrollments per week" },
  { key: "perMonth", label: "Maximum classes per month" },
  { key: "entire", label: "Maximum classes in the entire period" },
];

function daysBetween(start: string, expire: string): number {
  return Math.max(1, (new Date(expire).getTime() - new Date(start).getTime()) / 86_400_000);
}

export function SubscriptionsBalanceReport({ data }: { data: SubscriptionsData }) {
  const t = useT();
  const [group, setGroup] = React.useState("all");
  const [limits, setLimits] = React.useState<Record<LimitKey, Limit>>({
    perDay: { on: false, val: 0 },
    perWeek: { on: false, val: 0 },
    perMonth: { on: false, val: 0 },
    entire: { on: false, val: 0 },
  });

  const setLimit = (key: LimitKey, patch: Partial<Limit>) =>
    setLimits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const groupOptions = React.useMemo(
    () => [{ value: "all", label: "All" }, ...data.groups.map((g) => ({ value: g, label: g }))],
    [data.groups]
  );

  const rows = React.useMemo(() => {
    return data.rows.filter((r) => {
      if (group !== "all" && r.group !== group) return false;
      const enrolled = r.classesEnrolled ?? 0;
      const days = daysBetween(r.startDate, r.expireDate);
      if (limits.perDay.on && enrolled / days > limits.perDay.val) return false;
      if (limits.perWeek.on && enrolled / (days / 7) > limits.perWeek.val) return false;
      if (limits.perMonth.on && enrolled / (days / 30) > limits.perMonth.val) return false;
      if (limits.entire.on && enrolled > limits.entire.val) return false;
      return true;
    });
  }, [data.rows, group, limits]);

  const extraColumns = React.useMemo<ExtraColumn[]>(
    () => [
      { key: "classesEnrolled", label: "Classes Enrolled", value: (r: SubscriptionRow) => r.classesEnrolled ?? 0 },
      { key: "maxEnrollments", label: "Max Enrollments", value: (r: SubscriptionRow) => (r.maxEnrollments == null ? "—" : r.maxEnrollments) },
    ],
    []
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groupOptions} muted className="w-full sm:w-52" />
          {LIMIT_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <Switch checked={limits[f.key].on} onCheckedChange={(v) => setLimit(f.key, { on: v })} aria-label={t("Enable {label}", { label: t(f.label) })} />
              <FilterField label={f.label} className="w-full sm:w-52">
                <Input
                  type="number"
                  min={0}
                  className="h-11"
                  value={limits[f.key].val}
                  disabled={!limits[f.key].on}
                  onChange={(e) => setLimit(f.key, { val: Number(e.target.value) || 0 })}
                />
              </FilterField>
            </div>
          ))}
        </div>

        <SubscriptionReportTable rows={rows} filename="subscriptions-balance-report.csv" extraColumns={extraColumns} />
      </CardContent>
    </Card>
  );
}
