"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { ResponsiveChart } from "@/components/dashboard/responsive-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DonutSlice } from "@/lib/dashboard";
import { useT } from "@/lib/i18n/provider";

/**
 * Donut widget shared by "Active Subscriptions By Group" and "...By Period".
 * Renders the inner "Total N" label, a "Classes Subscriptions" sub-header, and
 * a wrapping legend with per-slice percentages — matching the reference.
 */
export function DonutCard({
  title,
  subtitle = "Classes Subscriptions",
  data,
}: {
  title: string;
  subtitle?: string;
  data: DonutSlice[];
}) {
  const t = useT();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const pct = (value: number) =>
    total === 0 ? "0" : ((value / total) * 100).toFixed(1).replace(/\.0$/, "");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bordered inner panel matches the reference's card-in-card framing */}
        <div className="rounded-xl ring-1 ring-foreground/10">
          <p className="border-b px-4 py-3 text-sm font-semibold">{t(subtitle)}</p>

          <div className="relative h-64 px-2 py-4">
            <ResponsiveChart>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${value} (${pct(Number(value))}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveChart>

            {/* Center total — overlaid because Recharts has no native center label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm text-muted-foreground">{t("Total")}</span>
              <span className="text-2xl font-semibold">{total}</span>
            </div>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t px-4 py-3">
            {data.map((slice) => (
              <li
                key={slice.label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span dir="auto" className="max-w-40 truncate">
                  {slice.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
