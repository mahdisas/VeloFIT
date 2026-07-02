import { Calendar, LogIn } from "lucide-react";

import { MetricStat } from "@/components/dashboard/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type DashboardMetrics, formatCurrency } from "@/lib/dashboard";
import { getT } from "@/lib/i18n/server";

/**
 * Top metric row: 4 cards, the last holding Total Receipts + Total Invoices
 * side by side with a divider — matching the reference layout exactly.
 */
export async function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  const { sparklines } = metrics;
  const t = await getT();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent>
          <MetricStat
            title={t("Active subscriptions")}
            variant="bar"
            color="#5b8def"
            data={sparklines.activeSubscriptions}
            value={
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4 text-muted-foreground" />
                {metrics.activeSubscriptions}
              </span>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <MetricStat
            title={t("Today Entrances")}
            variant="area"
            color="#ef4444"
            data={sparklines.todayEntrances}
            value={
              <span className="flex items-center gap-1.5">
                <LogIn className="size-4 text-muted-foreground" />
                {metrics.todayEntrances}
              </span>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* Every payment received in the window — matches the Finance Payments
              report total and the chart's "Payments received" series. */}
          <MetricStat
            title={t("Payments received")}
            variant="area"
            color="#3b82f6"
            data={sparklines.totalDebits}
            value={formatCurrency(metrics.totalDebits)}
          />
        </CardContent>
      </Card>

      {/* Receipts + Invoices share the fourth card */}
      <Card>
        <CardContent className="flex gap-4">
          <div className="min-w-0 flex-1">
            <MetricStat
              title={t("Total Receipts")}
              variant="bar"
              color="#fbbf24"
              data={sparklines.totalReceipts}
              value={formatCurrency(metrics.totalReceipts)}
            />
          </div>
          <Separator orientation="vertical" />
          <div className="min-w-0 flex-1">
            <MetricStat
              title={t("Total Invoices")}
              variant="bar"
              color="#fbbf24"
              data={sparklines.totalInvoices}
              value={formatCurrency(metrics.totalInvoices)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
