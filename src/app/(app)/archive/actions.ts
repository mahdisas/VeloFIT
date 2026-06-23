"use server";

import { revalidatePath } from "next/cache";

import { getAuthedProfile } from "@/lib/dal";

/** Archive restore mutations. gym_id from the authed profile; RLS-scoped. */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function restoreUser(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "You don't have permission to manage staff." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_archived: false, is_active: true })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/archive/users");
  revalidatePath("/settings/users");
  return { ok: true, id };
}

export async function restoreClient(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error } = await supabase
    .from("clients")
    .update({ status: "active" })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/archive/clients");
  revalidatePath("/clients");
  return { ok: true, id };
}
