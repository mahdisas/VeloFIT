"use client";

import * as React from "react";
import { Dumbbell, Plus, Search, Target, Users } from "lucide-react";

import { PlanCard } from "@/components/workout-plans/plan-card";
import { PlanDialog } from "@/components/workout-plans/plan-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { GOAL_OPTIONS, LEVEL_OPTIONS, type ResolvedPlan } from "@/lib/workout-plans";

export function WorkoutPlansGrid({ plans: initial, trainers }: { plans: ResolvedPlan[]; trainers: IdName[] }) {
  const t = useT();
  const [plans, setPlans] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [goal, setGoal] = React.useState("all");
  const [level, setLevel] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter(
      (p) =>
        (goal === "all" || p.goal === goal) &&
        (level === "all" || p.level === level) &&
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.trainerName.toLowerCase().includes(q))
    );
  }, [plans, query, goal, level]);

  const assignments = plans.reduce((n, p) => n + p.assignedClients.length, 0);
  const avgWeeks = plans.length ? Math.round(plans.reduce((n, p) => n + p.durationWeeks, 0) / plans.length) : 0;

  const onSaved = (plan: ResolvedPlan) => setPlans((prev) => [plan, ...prev]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Dumbbell className="size-5" />} label={t("Workout Plans")} value={plans.length} />
        <Stat icon={<Users className="size-5" />} label={t("Active Assignments")} value={assignments} />
        <Stat icon={<Target className="size-5" />} label={t("Avg. Duration")} value={t("{n} wks", { n: avgWeeks })} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search plans")} className="ps-9" />
          </div>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" align="start">{GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" align="start">{LEVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}</SelectContent>
          </Select>
          <PlanDialog trainers={trainers} onSaved={onSaved}>
            <Button className="sm:ms-auto"><Plus className="size-4" /> {t("New Plan")}</Button>
          </PlanDialog>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">{t("No plans match your filters.")}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="grid size-11 shrink-0 place-content-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
