"use client";

import { ChartColumnBig } from "lucide-react";

import { useT } from "@/lib/i18n/provider";

/** Shown in place of a dashboard chart when every series is empty/zero, so an
 *  all-zero gym reads as "nothing yet" instead of a misleading flat line. */
export function ChartEmptyState() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <ChartColumnBig className="size-8 opacity-40" />
      <p className="text-sm">{t("No data for this period yet")}</p>
    </div>
  );
}
