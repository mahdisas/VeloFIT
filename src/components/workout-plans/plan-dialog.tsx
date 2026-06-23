"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, SendHorizontal, Trash2 } from "lucide-react";

import { savePlan } from "@/app/(app)/workout-plans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import {
  type Exercise,
  GOAL_META,
  type Goal,
  LEVEL_META,
  type Level,
  type ResolvedPlan,
  type WorkoutDay,
} from "@/lib/workout-plans";

type DayDraft = WorkoutDay & { exercises: Exercise[] };

const emptyExercise = (): Exercise => ({ name: "", sets: 3, reps: "10", restSec: 60 });
const emptyDay = (): DayDraft => ({ id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", focus: "", exercises: [emptyExercise()] });

export function PlanDialog({ plan, trainers, onSaved, children }: { plan?: ResolvedPlan; trainers: IdName[]; onSaved: (plan: ResolvedPlan) => void; children: React.ReactNode }) {
  const tr = useT();
  const isEdit = Boolean(plan);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [goal, setGoal] = React.useState<Goal>("strength");
  const [level, setLevel] = React.useState<Level>("beginner");
  const [durationWeeks, setDurationWeeks] = React.useState(8);
  const [trainerId, setTrainerId] = React.useState(trainers[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [days, setDays] = React.useState<DayDraft[]>([emptyDay()]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    if (plan) {
      setName(plan.name); setGoal(plan.goal); setLevel(plan.level); setDurationWeeks(plan.durationWeeks);
      setTrainerId(plan.trainerId); setDescription(plan.description);
      setDays(plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })));
    } else {
      setName(""); setGoal("strength"); setLevel("beginner"); setDurationWeeks(8);
      setTrainerId(trainers[0]?.id ?? ""); setDescription(""); setDays([emptyDay()]);
    }
    setError(null);
  }, [open, plan, trainers]);

  const patchDay = (id: string, patch: Partial<DayDraft>) => setDays((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const patchExercise = (dayId: string, idx: number, patch: Partial<Exercise>) =>
    setDays((p) => p.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) } : d)));
  const addExercise = (dayId: string) => setDays((p) => p.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d)));
  const removeExercise = (dayId: string, idx: number) => setDays((p) => p.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((_, i) => i !== idx) } : d)));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(tr("Plan name is required."));
    const cleanDays: WorkoutDay[] = days
      .map((d) => ({ ...d, name: d.name.trim() || tr("Untitled day"), exercises: d.exercises.filter((ex) => ex.name.trim()) }))
      .filter((d) => d.exercises.length > 0);
    if (cleanDays.length === 0) return setError(tr("Add at least one workout day with an exercise."));

    startTransition(async () => {
      const result = await savePlan({ id: plan?.id, name, goal, level, durationWeeks, description, trainerId, color: GOAL_META[goal].color, days: cleanDays });
      if (!result.ok) return setError(result.error);
      onSaved({
        id: result.id,
        name, goal, level, durationWeeks, description, trainerId,
        color: GOAL_META[goal].color,
        days: cleanDays,
        createdAt: plan?.createdAt ?? new Date().toISOString().slice(0, 10),
        trainerName: trainers.find((t) => t.id === trainerId)?.name ?? "—",
        assignedClients: plan?.assignedClients ?? [],
        daysPerWeek: cleanDays.length,
        exerciseCount: cleanDays.reduce((n, d) => n + d.exercises.length, 0),
      });
      toast.success(isEdit ? tr("Workout plan updated") : tr("Workout plan created"));
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4"><SheetTitle>{isEdit ? tr("Edit Workout Plan") : tr("New Workout Plan")}</SheetTitle></SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={tr("Plan name")}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Foundation Strength")} /></Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tr("Goal")}>
                <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                  <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start">{Object.entries(GOAL_META).map(([v, m]) => <SelectItem key={v} value={v}>{tr(m.label)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={tr("Level")}>
                <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                  <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start">{Object.entries(LEVEL_META).map(([v, m]) => <SelectItem key={v} value={v}>{tr(m.label)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={tr("Duration (weeks)")}><Input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value) || 1)} /></Field>
            </div>

            <Field label={tr("Trainer")}>
              <Select value={trainerId || undefined} onValueChange={setTrainerId}>
                <SelectTrigger className="h-9 w-full sm:w-1/2"><SelectValue placeholder={tr("Select trainer")} /></SelectTrigger>
                <SelectContent position="popper" align="start">{trainers.map((t) => <SelectItem key={t.id} value={t.id}><span dir="auto">{t.name}</span></SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <Field label={tr("Description")}><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={tr("What is this plan about?")} /></Field>

            {/* Day / exercise builder */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{tr("Workout days")}</span>
                <button type="button" onClick={() => setDays((p) => [...p, emptyDay()])} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <Plus className="size-4" /> {tr("Add day")}
                </button>
              </div>

              {days.map((d, di) => (
                <div key={d.id} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    <span className="text-xs font-semibold text-muted-foreground">{tr("Day {n}", { n: di + 1 })}</span>
                    <Input value={d.name} onChange={(e) => patchDay(d.id, { name: e.target.value })} placeholder={tr("Day name (e.g. Push)")} className="h-8 flex-1" />
                    <Input value={d.focus} onChange={(e) => patchDay(d.id, { focus: e.target.value })} placeholder={tr("Focus")} className="h-8 w-32" dir="auto" />
                    {days.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={tr("Remove day")} onClick={() => setDays((p) => p.filter((x) => x.id !== d.id))}><Trash2 className="size-4" /></Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <div className="hidden grid-cols-[1fr_3.5rem_4rem_4rem_2rem] gap-2 text-xs font-medium text-muted-foreground sm:grid">
                      <span>{tr("Exercise")}</span><span>{tr("Sets")}</span><span>{tr("Reps")}</span><span>{tr("Rest s")}</span><span />
                    </div>
                    {d.exercises.map((exr, ei) => (
                      <div key={ei} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_3.5rem_4rem_4rem_2rem] sm:items-center">
                        <Input value={exr.name} onChange={(e) => patchExercise(d.id, ei, { name: e.target.value })} placeholder={tr("Exercise name")} className="h-8" />
                        <Input type="number" min={1} value={exr.sets} onChange={(e) => patchExercise(d.id, ei, { sets: Number(e.target.value) || 1 })} className="h-8" />
                        <Input value={exr.reps} onChange={(e) => patchExercise(d.id, ei, { reps: e.target.value })} className="h-8" />
                        <Input type="number" min={0} value={exr.restSec} onChange={(e) => patchExercise(d.id, ei, { restSec: Number(e.target.value) || 0 })} className="h-8" />
                        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={tr("Remove exercise")} onClick={() => removeExercise(d.id, ei)}><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addExercise(d.id)} className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="size-3.5" /> {tr("Add exercise")}</button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>{tr("Cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? tr("Saving…") : isEdit ? tr("Update plan") : tr("Create plan")} <SendHorizontal className="size-4" /></Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
