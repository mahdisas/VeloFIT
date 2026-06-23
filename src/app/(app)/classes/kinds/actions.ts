"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Class Kinds mutations. gym_id always comes from the authed profile; RLS scopes
 * the writes to the gym. Image upload (Supabase Storage) is not wired yet, so
 * the dropzone's file name is accepted but image_url stays null.
 */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().optional().default(""),
    minParticipants: z.number().int().min(0),
    maxParticipants: z.number().int().min(0),
    imageName: z.string().optional(),
  })
  .refine((v) => v.maxParticipants === 0 || v.maxParticipants >= v.minParticipants, {
    message: "Max participants must be ≥ min participants",
    path: ["maxParticipants"],
  });

export type ClassKindInput = z.infer<typeof schema>;

export async function saveClassKind(input: ClassKindInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    description: v.description?.trim() ? v.description.trim() : null,
    min_participants: v.minParticipants,
    max_participants: v.maxParticipants > 0 ? v.maxParticipants : null, // 0 → no cap
  };

  if (v.id) {
    const { error } = await supabase.from("class_kinds").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/classes/kinds");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase
    .from("class_kinds")
    .insert({ gym_id: profile.gymId, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/classes/kinds");
  return { ok: true, id: data.id as string };
}

/**
 * Soft-delete (is_active = false → Inactive tab). A hard delete would fail for a
 * kind still referenced by a class (classes.kind_id is ON DELETE RESTRICT).
 */
export async function deleteClassKind(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error } = await supabase
    .from("class_kinds")
    .update({ is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/classes/kinds");
  return { ok: true, id };
}
