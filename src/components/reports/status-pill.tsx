"use client";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Tone-based status pill, shared across report tables. */
export type PillTone = "green" | "rose" | "red" | "blue" | "amber" | "gray";

const TONES: Record<PillTone, string> = {
  green: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-500",
  red: "bg-red-50 text-red-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  gray: "bg-muted text-muted-foreground",
};

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium", TONES[tone])}>
      {t(label)}
    </span>
  );
}
