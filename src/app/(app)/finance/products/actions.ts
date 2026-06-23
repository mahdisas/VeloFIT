"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Products mutations. gym_id from the authed profile; RLS-scoped. Image upload
 * (Supabase Storage) isn't wired, so the dropzone's file name is accepted but
 * image_url is left untouched.
 */

export type ProductInput = {
  id?: string;
  name: string;
  categoryId: string | null;
  price: number;
  showInApp: boolean;
  description?: string;
  imageName?: string;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  price: z.number().min(0, "Price must be 0 or more"),
  showInApp: z.boolean(),
  description: z.string().optional(),
  imageName: z.string().optional(),
});

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    category_id: v.categoryId,
    price: v.price,
    show_in_app: v.showInApp,
    description: v.description?.trim() ? v.description.trim() : null,
  };

  if (v.id) {
    const { error } = await supabase.from("products").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/finance/products");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase.from("products").insert({ gym_id: profile.gymId, ...row }).select("id").single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/products");
  return { ok: true, id: data.id as string };
}

/** Soft-delete (is_active = false). */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/products");
  return { ok: true, id };
}
