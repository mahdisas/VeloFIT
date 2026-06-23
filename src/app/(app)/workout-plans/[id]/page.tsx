import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanDetailView } from "@/components/workout-plans/plan-detail-view";
import { getTrainerOptions, getWorkoutPlan } from "@/lib/workout-plans-server";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const plan = await getWorkoutPlan(id);
  return { title: plan ? plan.name : "Workout Plan" };
}

export default async function WorkoutPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan, trainers] = await Promise.all([getWorkoutPlan(id), getTrainerOptions()]);
  if (!plan) notFound();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <Link href="/workout-plans" className="hover:text-foreground">{t("Workout Plans")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{plan.name}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{plan.name}</h1>

      <PlanDetailView initialPlan={plan} trainers={trainers} />
    </div>
  );
}
