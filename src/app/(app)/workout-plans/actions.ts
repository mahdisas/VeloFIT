"use server";

import { revalidatePath } from "next/cache";

import { getAuthedProfile } from "@/lib/dal";
import { toDbGoal } from "@/lib/workout-plans-server";
import { type Goal, type Level, type WorkoutDay } from "@/lib/workout-plans";

/**
 * Workout plan mutations. gym_id from the authed profile; RLS-scoped. savePlan
 * writes the parent plan then replaces its workout_days + workout_exercises;
 * deletePlan cascades to days/exercises/assignments.
 */

export type PlanInput = {
  id?: string;
  name: string;
  goal: Goal;
  level: Level;
  durationWeeks: number;
  description: string;
  trainerId: string;
  color: string;
  days: WorkoutDay[];
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/** Insert the day rows + their exercises for a plan. Returns an error string on failure. */
async function insertDays(supabase: ServerClient, gymId: string, planId: string, days: WorkoutDay[]): Promise<string | null> {
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const { data: dayRow, error: dayError } = await supabase
      .from("workout_days")
      .insert({ gym_id: gymId, plan_id: planId, position: di, name: day.name.trim() || `Day ${di + 1}`, focus: day.focus?.trim() || null })
      .select("id")
      .single();
    if (dayError) return dayError.message;

    const exercises = day.exercises
      .filter((e) => e.name.trim())
      .map((e, ei) => ({
        gym_id: gymId,
        day_id: dayRow.id as string,
        position: ei,
        name: e.name.trim(),
        sets: Math.max(1, e.sets),
        reps: e.reps.trim() || "1",
        rest_sec: Math.max(0, e.restSec),
        notes: e.notes?.trim() ? e.notes.trim() : null,
      }));
    if (exercises.length) {
      const { error: exError } = await supabase.from("workout_exercises").insert(exercises);
      if (exError) return exError.message;
    }
  }
  return null;
}

export async function savePlan(input: PlanInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  if (!input.name.trim()) return { ok: false, error: "Plan name is required" };
  if (input.durationWeeks < 1) return { ok: false, error: "Duration must be at least 1 week" };
  if (input.days.length === 0) return { ok: false, error: "Add at least one workout day" };

  const planRow = {
    name: input.name.trim(),
    goal: toDbGoal(input.goal),
    level: input.level,
    duration_weeks: input.durationWeeks,
    description: input.description.trim() ? input.description.trim() : null,
    trainer_id: input.trainerId || null,
    color: input.color || "#3b82f6",
  };

  if (input.id) {
    const { error } = await supabase.from("workout_plans").update(planRow).eq("id", input.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };

    // Replace the day/exercise tree.
    await supabase.from("workout_days").delete().eq("plan_id", input.id).eq("gym_id", profile.gymId);
    const childError = await insertDays(supabase, profile.gymId, input.id, input.days);
    if (childError) return { ok: false, error: childError };

    revalidatePath("/workout-plans");
    revalidatePath(`/workout-plans/${input.id}`);
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase.from("workout_plans").insert({ gym_id: profile.gymId, ...planRow }).select("id").single();
  if (error) return { ok: false, error: error.message };
  const planId = data.id as string;

  const childError = await insertDays(supabase, profile.gymId, planId, input.days);
  if (childError) {
    await supabase.from("workout_plans").delete().eq("id", planId).eq("gym_id", profile.gymId); // roll back
    return { ok: false, error: childError };
  }

  revalidatePath("/workout-plans");
  return { ok: true, id: planId };
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  // Cascades to workout_days / workout_exercises / workout_plan_assignments.
  const { error } = await supabase.from("workout_plans").delete().eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/workout-plans");
  return { ok: true, id };
}

/** Replace the plan's assigned clients with the given set. */
export async function assignClients(planId: string, clientIds: string[]): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error: delError } = await supabase
    .from("workout_plan_assignments")
    .delete()
    .eq("plan_id", planId)
    .eq("gym_id", profile.gymId);
  if (delError) return { ok: false, error: delError.message };

  if (clientIds.length) {
    const rows = clientIds.map((client_id) => ({
      gym_id: profile.gymId,
      plan_id: planId,
      client_id,
      assigned_by: profile.userId,
    }));
    const { error: insError } = await supabase.from("workout_plan_assignments").insert(rows);
    if (insError) return { ok: false, error: insError.message };
  }

  revalidatePath("/workout-plans");
  revalidatePath(`/workout-plans/${planId}`);
  return { ok: true, id: planId };
}
