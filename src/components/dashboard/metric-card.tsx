"use client";

import { Area, AreaChart, Bar, BarChart, Tooltip } from "recharts";

import { ResponsiveChart } from "@/components/dashboard/responsive-chart";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, type SparkPoint } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type MetricStatProps = {
  title: string;
  /** Headline value — string or rich content (e.g. icon + count pairs) */
  value: React.ReactNode;
  data: SparkPoint[];
  variant: "bar" | "area";
  /** Sparkline color (hex) — matches the reference palette per metric */
  color: string;
  /** Hover tooltip series name (e.g. "Entrances: 12"). Falls back to the title. */
  seriesLabel?: string;
  /** Format the hovered value as money. A flag (not a function) because this is
   *  rendered from a Server Component — functions can't cross that boundary. */
  currency?: boolean;
};

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
};

/**
 * Title + value + mini sparkline. Rendered bare so two stats can share one
 * card (Total Receipts | Total Invoices), or wrapped via <MetricCard />.
 * Hovering a bar/point shows "<series>: <value>" like the reference dashboard.
 */
export function MetricStat({ title, value, data, variant, color, seriesLabel, currency = false }: MetricStatProps) {
  const tooltip = (
    <Tooltip
      cursor={variant === "bar" ? { fill: "var(--muted)", opacity: 0.6 } : { stroke: "var(--border)", strokeDasharray: "3 3" }}
      formatter={(v) => [currency ? formatCurrency(Number(v ?? 0)) : (v ?? 0), seriesLabel ?? title]}
      labelFormatter={() => ""}
      separator=": "
      contentStyle={TOOLTIP_STYLE}
      isAnimationActive={false}
    />
  );

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-auto h-20 pt-2">
        <ResponsiveChart>
          {variant === "bar" ? (
            <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              {tooltip}
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
              {tooltip}
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
