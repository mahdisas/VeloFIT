import type { Metadata } from "next";
import Link from "next/link";

import { WorkoutPlansGrid } from "@/components/workout-plans/workout-plans-grid";
import { getTrainerOptions, getWorkoutPlans } from "@/lib/workout-plans-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Workout Plans" };

export default async function WorkoutPlansPage() {
  const [plans, trainers] = await Promise.all([getWorkoutPlans(), getTrainerOptions()]);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Workout Plans")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Workout Plans")}</h1>

      <WorkoutPlansGrid plans={plans} trainers={trainers} />
    </div>
  );
}
