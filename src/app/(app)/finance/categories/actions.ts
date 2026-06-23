"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/** Categories mutations. gym_id from the authed profile; RLS-scoped. */

export type CategoryInput = { id?: string; name: string; description?: string };
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
});

const DUP = "A category with this name already exists.";

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = { name: v.name.trim(), description: v.description?.trim() ? v.description.trim() : null };

  if (v.id) {
    const { error } = await supabase.from("product_categories").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };
    revalidatePath("/finance/categories");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase.from("product_categories").insert({ gym_id: profile.gymId, ...row }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };

  revalidatePath("/finance/categories");
  revalidatePath("/finance/products");
  return { ok: true, id: data.id as string };
}

/** Soft-delete (is_active = false) — preserves history and orphan products keep their (now blank) category. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("product_categories")
    .update({ is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/categories");
  return { ok: true, id };
}
