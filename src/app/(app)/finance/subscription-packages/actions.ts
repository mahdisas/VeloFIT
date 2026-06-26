"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Subscription Package mutations → the subscription_plans catalog. gym_id from
 * the authed profile; RLS-scoped.
 */

export type PackageInput = {
  id?: string;
  name: string;
  color: string;
  groupId: string | null;
  price: number;
  maxPurchases: number;
  periodMonths: number;
  maximumPayments: number;
  isTrialLesson: boolean;
  showInApp: boolean;
  description?: string;
  isClassPlan: boolean;
  classesLimit: number | null;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  color: z.string(),
  groupId: z.string().nullable(),
  price: z.number().min(0, "Price must be 0 or more"),
  maxPurchases: z.number().int().min(0),
  periodMonths: z.number().int().min(1, "Period must be at least 1 month"),
  maximumPayments: z.number().int().min(1),
  isTrialLesson: z.boolean(),
  showInApp: z.boolean(),
  description: z.string().optional(),
  isClassPlan: z.boolean(),
  classesLimit: z.number().int().positive().nullable(),
}).refine((d) => !d.isClassPlan || (d.classesLimit != null && d.classesLimit >= 1), {
  message: "A class pass needs a classes limit of at least 1.",
  path: ["classesLimit"],
});

export async function savePackage(input: PackageInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    color: v.color || "#ec1c79",
    group_id: v.groupId || null,
    price: v.price,
    max_purchases: v.maxPurchases,
    period_months: v.periodMonths,
    max_payments: v.maximumPayments,
    is_trial_lesson: v.isTrialLesson,
    show_in_app: v.showInApp,
    description: v.description?.trim() ? v.description.trim() : null,
    is_class_plan: v.isClassPlan,
    classes_limit: v.isClassPlan ? v.classesLimit : null,
  };

  if (v.id) {
    const { error } = await supabase.from("subscription_plans").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/finance/subscription-packages");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase.from("subscription_plans").insert({ gym_id: profile.gymId, ...row }).select("id").single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/subscription-packages");
  return { ok: true, id: data.id as string };
}

/** Soft-delete (is_active = false). Hard delete would be blocked by subscriptions.plan_id (RESTRICT). */
export async function deletePackage(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("subscription_plans").update({ is_active: false }).eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/subscription-packages");
  return { ok: true, id };
}
