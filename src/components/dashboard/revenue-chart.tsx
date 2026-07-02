"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartEmptyState } from "@/components/dashboard/chart-empty-state";
import { ResponsiveChart } from "@/components/dashboard/responsive-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, type RevenuePoint } from "@/lib/dashboard";
import { useT } from "@/lib/i18n/provider";

const SERIES = [
  // `receipts` carries REAL revenue: every payment received, by the month the
  // money arrived — so the label says exactly that (not "Receipts", which is a
  // document type; those live in the Total Receipts card).
  { key: "receipts", name: "Payments received", color: CHART_COLORS.lightBlue },
  { key: "invoices", name: "Invoices", color: CHART_COLORS.blue },
] as const;

/** "Revenue 6 Months" — payments received vs paid invoices, per month. */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const t = useT();
  // With an all-zero gym both lines sit on the baseline and overlap exactly, so
  // they read as a single flat line — show an explicit empty state instead.
  const hasData = data.some((d) => d.receipts > 0 || d.invoices > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("Revenue 6 Months")}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-80 flex-col">
        {!hasData ? (
          <ChartEmptyState />
        ) : (
          <>
            <div className="min-h-0 flex-1">
        <ResponsiveChart>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                fontSize: 12,
              }}
            />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={t(s.name)}
                type="monotone"
                stroke={s.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveChart>
            </div>
            <ChartLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChartLegend() {
  const t = useT();
  return (
    <div className="mt-3 flex items-center justify-center gap-6">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          {t(s.name)}
        </span>
      ))}
    </div>
  );
}
