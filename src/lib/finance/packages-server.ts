import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type SubscriptionPackage } from "@/lib/finance/packages";

type PlanRow = {
  id: string;
  name: string;
  color: string | null;
  group_id: string | null;
  price: number;
  max_purchases: number;
  period_months: number;
  max_payments: number;
  is_trial_lesson: boolean;
  show_in_app: boolean;
  description: string | null;
  is_class_plan: boolean;
  classes_limit: number | null;
  is_active: boolean;
  group: { name: string } | null;
};

/**
 * Subscription packages = the subscription_plans catalog, joined to the class
 * group name (Finance · Subscription Packages).
 */
export async function getPackages(): Promise<SubscriptionPackage[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id, name, color, group_id, price, max_purchases, period_months, max_payments, is_trial_lesson, show_in_app, description, is_class_plan, classes_limit, is_active, group:class_groups(name)"
    )
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load packages: ${error.message}`);

  return ((data ?? []) as unknown as PlanRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color ?? "#ec1c79",
    groupId: p.group_id,
    groupName: p.group?.name ?? "",
    price: Number(p.price),
    maxPurchases: p.max_purchases,
    periodMonths: p.period_months,
    maximumPayments: p.max_payments,
    isTrialLesson: p.is_trial_lesson,
    showInApp: p.show_in_app,
    description: p.description ?? "",
    isClassPlan: p.is_class_plan,
    classesLimit: p.classes_limit,
    isActive: p.is_active,
  }));
}

/** Active class-group options for the package drawer's "Subscription Group" select. */
export async function getGroupOptions(): Promise<{ id: string; name: string }[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("class_groups")
    .select("id, name")
    .eq("gym_id", profile.gymId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load groups: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}
