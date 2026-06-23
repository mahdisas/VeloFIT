"use client";

import Link from "next/link";
import { CalendarRange, Dumbbell, ListChecks } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n/provider";
import { GOAL_META, LEVEL_META, type ResolvedPlan } from "@/lib/workout-plans";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] ?? ""}${p[1]?.[0] ?? ""}`.trim();
}

export function PlanCard({ plan }: { plan: ResolvedPlan }) {
  const t = useT();
  const goal = GOAL_META[plan.goal];
  return (
    <Link
      href={`/workout-plans/${plan.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: plan.color }} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-tight">{plan.name}</h3>
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${goal.color}1a`, color: goal.color }}>
            {t(goal.label)}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarRange className="size-3.5" /> {t("{n} weeks", { n: plan.durationWeeks })}</span>
          <span className="inline-flex items-center gap-1.5"><Dumbbell className="size-3.5" /> {t("{n} days/week", { n: plan.daysPerWeek })}</span>
          <span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" /> {t("{n} exercises", { n: plan.exerciseCount })}</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground" dir="auto">{plan.trainerName}</span>
            <span className="mx-1.5">·</span>
            {t(LEVEL_META[plan.level].label)}
          </span>
          <div className="flex -space-x-2">
            {plan.assignedClients.slice(0, 4).map((c) => (
              <Avatar key={c.id} className="size-7 ring-2 ring-card">
                <AvatarFallback className="bg-accent text-[10px] font-medium text-accent-foreground"><span dir="auto">{initials(c.name)}</span></AvatarFallback>
              </Avatar>
            ))}
            {plan.assignedClients.length > 4 && (
              <span className={cn("grid size-7 place-content-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card")}>
                +{plan.assignedClients.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
