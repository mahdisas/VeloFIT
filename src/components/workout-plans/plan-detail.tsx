"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, Dumbbell, ListChecks, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n/provider";
import { GOAL_META, LEVEL_META, type ResolvedPlan } from "@/lib/workout-plans";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] ?? ""}${p[1]?.[0] ?? ""}`.trim();
}

function rest(sec: number): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function PlanDetail({ plan, actions }: { plan: ResolvedPlan; actions?: React.ReactNode }) {
  const t = useT();
  const goal = GOAL_META[plan.goal];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="h-2 w-full" style={{ backgroundColor: plan.color }} />
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${goal.color}1a`, color: goal.color }}>{t(goal.label)}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t(LEVEL_META[plan.level].label)}</span>
              </div>
            </div>
            {actions}
          </div>

          <p className="max-w-3xl text-sm text-muted-foreground">{plan.description}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarRange className="size-4" /> {t("{n} weeks", { n: plan.durationWeeks })}</span>
            <span className="inline-flex items-center gap-1.5"><Dumbbell className="size-4" /> {t("{n} days/week", { n: plan.daysPerWeek })}</span>
            <span className="inline-flex items-center gap-1.5"><ListChecks className="size-4" /> {t("{n} exercises", { n: plan.exerciseCount })}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" /> <span dir="auto" className="font-medium text-foreground">{plan.trainerName}</span></span>
          </div>

          {/* Assigned clients */}
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-sm font-medium">{t("Assigned clients ({n})", { n: plan.assignedClients.length })}</span>
            <div className="flex flex-wrap gap-2">
              {plan.assignedClients.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t("No clients assigned yet.")}</span>
              ) : (
                plan.assignedClients.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pe-3 ps-1 text-sm transition-colors hover:border-primary/50 hover:bg-accent">
                    <Avatar className="size-6"><AvatarFallback className="bg-accent text-[10px] font-medium text-accent-foreground"><span dir="auto">{initials(c.name)}</span></AvatarFallback></Avatar>
                    <span dir="auto" className="font-medium text-primary">{c.name}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout days */}
      <div className="grid gap-4 lg:grid-cols-2">
        {plan.days.map((d, i) => (
          <Card key={d.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-content-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: plan.color }}>{i + 1}</span>
                <div className="flex flex-col">
                  <span className="font-semibold leading-tight">{d.name}</span>
                  {d.focus && <span className="text-xs text-muted-foreground" dir="auto">{d.focus}</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-muted-foreground">{t("Exercise")}</TableHead>
                      <TableHead className="text-muted-foreground">{t("Sets")}</TableHead>
                      <TableHead className="text-muted-foreground">{t("Reps")}</TableHead>
                      <TableHead className="text-muted-foreground">{t("Rest")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.exercises.map((e, ei) => (
                      <TableRow key={ei}>
                        <TableCell>
                          <span className="font-medium" dir="auto">{e.name}</span>
                          {e.notes && <span className="block text-xs text-muted-foreground" dir="auto">{e.notes}</span>}
                        </TableCell>
                        <TableCell>{e.sets}</TableCell>
                        <TableCell>{e.reps}</TableCell>
                        <TableCell className="text-muted-foreground">{rest(e.restSec)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
