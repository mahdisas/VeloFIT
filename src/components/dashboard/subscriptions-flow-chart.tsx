"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ChartEmptyState } from "@/components/dashboard/chart-empty-state";
import { ResponsiveChart } from "@/components/dashboard/responsive-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SubscriptionFlowPoint } from "@/lib/dashboard";
import { useT } from "@/lib/i18n/provider";

const SERIES = [
  { key: "renewals", name: "Renewals", color: "#5b8def" },
  { key: "expirations", name: "Expirations", color: "#feb019" },
] as const;

/** "Subscriptions 6 Months" — grouped bars comparing renewals vs expirations. */
export function SubscriptionsFlowChart({ data }: { data: SubscriptionFlowPoint[] }) {
  const t = useT();
  const hasData = data.some((d) => d.renewals > 0 || d.expirations > 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("Subscriptions 6 Months")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <p className="border-b px-4 py-3 text-sm font-semibold">
            {t("Classes Subscriptions")}
          </p>
          <div className="h-80 px-2 py-4">
            {!hasData ? (
              <ChartEmptyState />
            ) : (
            <ResponsiveChart>
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                />
                {SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={t(s.name)}
                    fill={s.color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                ))}
              </BarChart>
            </ResponsiveChart>
            )}
          </div>
          <div className="flex items-center justify-center gap-6 border-t py-3">
            {SERIES.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {t(s.name)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
