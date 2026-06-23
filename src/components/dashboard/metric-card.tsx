"use client";

import { Area, AreaChart, Bar, BarChart } from "recharts";

import { ResponsiveChart } from "@/components/dashboard/responsive-chart";
import { Card, CardContent } from "@/components/ui/card";
import type { SparkPoint } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type MetricStatProps = {
  title: string;
  /** Headline value — string or rich content (e.g. icon + count pairs) */
  value: React.ReactNode;
  data: SparkPoint[];
  variant: "bar" | "area";
  /** Sparkline color (hex) — matches the reference palette per metric */
  color: string;
};

/**
 * Title + value + mini sparkline. Rendered bare so two stats can share one
 * card (Total Receipts | Total Invoices), or wrapped via <MetricCard />.
 */
export function MetricStat({ title, value, data, variant, color }: MetricStatProps) {
  return (
    <div className="flex h-full flex-col gap-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-auto h-20 pt-2">
        <ResponsiveChart>
          {variant === "bar" ? (
            <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                type="monotone"
                stroke={color}
                strokeWidth={2}
                fill={`url(#spark-${title.replace(/\s/g, "")})`}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveChart>
      </div>
    </div>
  );
}

export function MetricCard({
  className,
  ...stat
}: MetricStatProps & { className?: string }) {
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="h-full px-4">
        <MetricStat {...stat} />
      </CardContent>
    </Card>
  );
}
