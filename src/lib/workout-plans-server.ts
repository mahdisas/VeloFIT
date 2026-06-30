import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type IdName } from "@/lib/classes";
import { listTrainerOptions } from "@/lib/trainers-server";
import { type createClient } from "@/lib/supabase/server";
import { type Goal, type Level, type ResolvedPlan, type WorkoutDay } from "@/lib/workout-plans";

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Server-only workout-plan reads. The DB workout_goal enum uses 'weight_loss';
 * the app uses 'weight-loss' — mapped here. Days/exercises are ordered by their
 * `position` column.
 */

/** DB goal ('weight_loss') → app goal ('weight-loss'). */
export function toAppGoal(dbGoal: string): Goal {
  return (dbGoal === "weight_loss" ? "weight-loss" : dbGoal) as Goal;
}
/** App goal ('weight-loss') → DB goal ('weight_loss'). */
export function toDbGoal(appGoal: Goal): string {
  return appGoal === "weight-loss" ? "weight_loss" : appGoal;
}

const PLAN_SELECT = `
  id, name, goal, level, duration_weeks, description, trainer_id, color, created_at,
  trainer:trainers(full_name),
  days:workout_days(id, position, name, focus, exercises:workout_exercises(position, name, sets, reps, rest_sec, notes)),
  assignments:workout_plan_assignments(client:clients(id, full_name))
`;

type PlanRow = {
  id: string;
  name: string;
  goal: string;
  level: string;
  duration_weeks: number;
  description: string | null;
  trainer_id: string | null;
  color: string;
  created_at: string;
  trainer: { full_name: string } | null;
  days:
    | {
        id: string;
        position: number;
        name: string;
        focus: string | null;
        exercises: { position: number; name: string; sets: number; reps: string; rest_sec: number; notes: string | null }[] | null;
      }[]
    | null;
  assignments: { client: { id: string; full_name: string } | null }[] | null;
};

function resolve(p: PlanRow): ResolvedPlan {
  const days: WorkoutDay[] = (p.days ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus ?? "",
      exercises: (d.exercises ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, restSec: e.rest_sec, notes: e.notes ?? undefined })),
    }));

  const assignedClients = (p.assignments ?? [])
    .map((a) => a.client)
    .filter((c): c is { id: string; full_name: string } => Boolean(c))
    .map((c) => ({ id: c.id, name: c.full_name }));

  return {
    id: p.id,
    name: p.name,
    goal: toAppGoal(p.goal),
    level: p.level as Level,
    durationWeeks: p.duration_weeks,
    description: p.description ?? "",
    trainerId: p.trainer_id ?? "",
    color: p.color,
    createdAt: p.created_at.slice(0, 10),
    trainerName: p.trainer?.full_name ?? "—",
    assignedClients,
    days,
    daysPerWeek: days.length,
    exerciseCount: days.reduce((n, d) => n + d.exercises.length, 0),
  };
}

export async function getWorkoutPlans(): Promise<ResolvedPlan[]> {
  const { supabase, profile } = await getAuthedProfile();
  return getWorkoutPlansFor(supabase, profile.gymId);
}

export async function getWorkoutPlansFor(supabase: DB, gymId: string): Promise<ResolvedPlan[]> {
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_SELECT)
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load workout plans: ${error.message}`);
  return ((data ?? []) as unknown as PlanRow[]).map(resolve);
}

export async function getWorkoutPlan(id: string): Promise<ResolvedPlan | null> {
  const { supabase, profile } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_SELECT)
    .eq("gym_id", profile.gymId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load workout plan: ${error.message}`);
  return data ? resolve(data as unknown as PlanRow) : null;
}

/** Trainer options for the plan editor — real staff (role 'trainer'), bridged
 * into the trainers table. Shared with the Classes wizard via listTrainerOptions. */
export async function getTrainerOptions(): Promise<IdName[]> {
  const { supabase, profile } = await getAuthedProfile();
  return listTrainerOptions(supabase, profile.gymId);
}
