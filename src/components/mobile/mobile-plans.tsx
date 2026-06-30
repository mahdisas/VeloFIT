"use client";

import { CalendarDays, Dumbbell, ListChecks } from "lucide-react";

import { GOAL_META, LEVEL_META, type ResolvedPlan } from "@/lib/workout-plans";
import { useT } from "@/lib/i18n/provider";

/** Plans — the gym's workout plans as tappable-looking cards (read-only list). */
export function MobilePlans({ plans }: { plans: ResolvedPlan[] }) {
  const t = useT();

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <Dumbbell className="size-8" />
        <p className="text-sm">{t("No workout plans yet")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {plans.map((p) => {
        const goal = GOAL_META[p.goal];
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color || goal?.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" dir="auto">{p.name}</p>
                {p.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" dir="auto">{p.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill>{t(goal?.label ?? p.goal)}</Pill>
                  <Pill>{t(LEVEL_META[p.level]?.label ?? p.level)}</Pill>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{p.durationWeeks} {t("weeks")}</span>
                  <span className="inline-flex items-center gap-1"><Dumbbell className="size-3.5" />{p.daysPerWeek} {t("days/week")}</span>
                  <span className="inline-flex items-center gap-1"><ListChecks className="size-3.5" />{p.exerciseCount} {t("exercises")}</span>
                  {p.trainerName && p.trainerName !== "—" && <span dir="auto" className="truncate">{p.trainerName}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
