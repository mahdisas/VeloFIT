"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { deletePlan } from "@/app/(app)/workout-plans/actions";
import { PlanDetail } from "@/components/workout-plans/plan-detail";
import { PlanDialog } from "@/components/workout-plans/plan-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { type ResolvedPlan } from "@/lib/workout-plans";
import { cn } from "@/lib/utils";

export function PlanDetailView({ initialPlan, trainers }: { initialPlan: ResolvedPlan; trainers: IdName[] }) {
  const t = useT();
  const [plan, setPlan] = React.useState(initialPlan);
  const router = useRouter();

  const onDelete = () => {
    void deletePlan(plan.id);
    toast.success(t("Workout plan deleted"));
    router.push("/workout-plans");
  };

  return (
    <PlanDetail
      plan={plan}
      actions={
        <div className="flex items-center gap-2">
          <PlanDialog plan={plan} trainers={trainers} onSaved={setPlan}>
            <Button type="button" variant="outline"><Pencil className="size-4" /> {t("Edit")}</Button>
          </PlanDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="size-4" /> {t("Delete")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Delete this plan?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium text-foreground">{plan.name}</span> {t("and its {n} workout days will be permanently removed.", { n: plan.daysPerWeek })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={onDelete}>{t("Delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    />
  );
}
