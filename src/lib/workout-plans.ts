/**
 * Workout Plans — client-safe types + goal/level metadata.
 *
 * The real, RLS-scoped reads live in lib/workout-plans-server.ts
 * (getWorkoutPlans / getWorkoutPlan / getTrainerOptions); mutations in
 * app/(app)/workout-plans/actions.ts. Tables: workout_plans, workout_days,
 * workout_exercises, workout_plan_assignments.
 */

export type Goal = "strength" | "hypertrophy" | "weight-loss" | "endurance" | "mobility" | "general";
export type Level = "beginner" | "intermediate" | "advanced";

export const GOAL_META: Record<Goal, { label: string; color: string }> = {
  strength: { label: "Strength", color: "#3b82f6" },
  hypertrophy: { label: "Hypertrophy", color: "#a855f7" },
  "weight-loss": { label: "Weight Loss", color: "#f4593c" },
  endurance: { label: "Endurance", color: "#14b8a6" },
  mobility: { label: "Mobility", color: "#f59e0b" },
  general: { label: "General Fitness", color: "#22c55e" },
};

export const LEVEL_META: Record<Level, { label: string }> = {
  beginner: { label: "Beginner" },
  intermediate: { label: "Intermediate" },
  advanced: { label: "Advanced" },
};

export const GOAL_OPTIONS = [{ value: "all", label: "All goals" }, ...Object.entries(GOAL_META).map(([v, m]) => ({ value: v, label: m.label }))];
export const LEVEL_OPTIONS = [{ value: "all", label: "All levels" }, ...Object.entries(LEVEL_META).map(([v, m]) => ({ value: v, label: m.label }))];

export type Exercise = { name: string; sets: number; reps: string; restSec: number; notes?: string };
export type WorkoutDay = { id: string; name: string; focus: string; exercises: Exercise[] };

export type WorkoutPlan = {
  id: string;
  name: string;
  goal: Goal;
  level: Level;
  durationWeeks: number;
  description: string;
  trainerId: string;
  color: string;
  days: WorkoutDay[];
  createdAt: string;
};

export type AssignedClient = { id: string; name: string };
export type ResolvedPlan = WorkoutPlan & {
  trainerName: string;
  assignedClients: AssignedClient[];
  daysPerWeek: number;
  exerciseCount: number;
};
