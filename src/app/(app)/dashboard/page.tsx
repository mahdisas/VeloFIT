import type { Metadata } from "next";

import { DonutCard } from "@/components/dashboard/donut-card";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SubscriptionsFlowChart } from "@/components/dashboard/subscriptions-flow-chart";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions-table";
import { getDashboardData } from "@/lib/dashboard-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // One auth gate, then every widget computed from real, RLS-scoped rows.
  const { metrics, revenue, byGroup, flow, byPeriod, aboutToExpire, recentlyAdded } =
    await getDashboardData();
  const t = await getT();

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Row 1 — top metrics */}
      <MetricCards metrics={metrics} />

      {/* Row 2 — revenue (2/3) + by-group donut (1/3) */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart data={revenue} />
        </div>
        <DonutCard title={t("Active Subscriptions By Group")} data={byGroup} />
      </div>

      {/* Row 3 — subscriptions flow (2/3) + by-period donut (1/3) */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SubscriptionsFlowChart data={flow} />
        </div>
        <DonutCard title={t("Active Subscriptions By Period")} data={byPeriod} />
      </div>

      {/* Row 4 — bottom tables */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <SubscriptionsTable title={t("Subscriptions About To Expire")} rows={aboutToExpire} />
        <SubscriptionsTable title={t("Subscriptions Recently Added")} rows={recentlyAdded} />
      </div>

      <footer className="flex flex-col items-center justify-between gap-2 pt-2 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} {t("All rights reserved by veloFIT")}</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground">{t("About us")}</a>
          <a href="#" className="hover:text-foreground">{t("Privacy Policy")}</a>
        </div>
      </footer>
    </div>
  );
}
