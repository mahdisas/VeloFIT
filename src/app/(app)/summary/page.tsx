import type { Metadata } from "next";
import Link from "next/link";

import { SummaryBuilder } from "@/components/summary/summary-builder";
import { type SummaryLanguage, type SummaryParams } from "@/lib/summary";
import { getSummary } from "@/lib/summary-server";
import { getLocale, getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Summary" };

export default async function SummaryPage() {
  const now = new Date();
  // Default the share-card language to the dashboard's current locale, so the
  // card renders translated out of the box (still switchable in the UI).
  const locale = await getLocale();
  const initialParams: SummaryParams = {
    period: "year",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    language: locale as SummaryLanguage,
  };

  // Server-fetch the default so the share card renders immediately, no spinner.
  const initialData = await getSummary(initialParams);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Summary")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Summary")}</h1>

      <SummaryBuilder initialParams={initialParams} initialData={initialData} />
    </div>
  );
}
