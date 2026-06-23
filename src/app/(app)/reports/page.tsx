import type { Metadata } from "next";
import Link from "next/link";

import { REPORT_GROUPS } from "@/lib/reports";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Reports")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Reports")}</h1>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_GROUPS.map((group) => (
          <section key={group.id} className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-4 text-base font-semibold">{t(group.title)}</h2>
            <div className="flex flex-col gap-3 p-5">
              {group.reports.map((report) => (
                <Link
                  key={report.slug}
                  href={`/reports/${report.slug}`}
                  className="flex min-h-16 items-center justify-center rounded-lg border bg-background px-4 py-3 text-center text-sm font-medium text-foreground/90 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-accent hover:text-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t(report.title)}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
