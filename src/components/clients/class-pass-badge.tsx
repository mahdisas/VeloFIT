"use client";

import { Ticket } from "lucide-react";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Punch-card progress for a class-pass subscription: "7 / 12" while there are
 * credits left, flipping to an amber "Limit reached — renewal due" flag once
 * classes_used reaches classes_limit (the owner's cue to collect payment).
 */
export function ClassPassBadge({ used, limit }: { used: number; limit: number | null }) {
  const t = useT();
  if (limit == null) return <span className="text-muted-foreground">—</span>;

  const reached = used >= limit;
  return (
    <span
      title={reached ? t("Limit reached — renewal due") : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        reached
          ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-400/20"
          : "bg-primary/10 text-primary ring-primary/20"
      )}
    >
      <Ticket className="size-3.5 shrink-0" />
      <span dir="ltr">{used} / {limit}</span>
      {reached && <span>· {t("Renewal due")}</span>}
    </span>
  );
}
