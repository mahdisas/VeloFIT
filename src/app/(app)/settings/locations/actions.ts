"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/** Location mutations. gym_id from the authed profile; RLS scopes the writes. */

export type LocationInput = { id?: string; name: string; description?: string };
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
});

const DUP = "A location with this name already exists.";

export async function saveLocation(input: LocationInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = { name: v.name.trim(), description: v.description?.trim() ? v.description.trim() : null };

  if (v.id) {
    const { error } = await supabase.from("locations").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };
    revalidatePath("/settings/locations");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase.from("locations").insert({ gym_id: profile.gymId, ...row }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };

  revalidatePath("/settings/locations");
  return { ok: true, id: data.id as string };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  // Hard delete is safe: classes.location_id is ON DELETE SET NULL.
  const { error } = await supabase.from("locations").delete().eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/locations");
  return { ok: true, id };
}
