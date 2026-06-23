"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/** Measurement Type mutations. gym_id from the authed profile; RLS-scoped. */

export type MeasurementTypeInput = {
  id?: string;
  name: string;
  unit: string;
  notes?: string;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  unit: z.string(),
  notes: z.string().optional(),
});

export async function saveMeasurementType(input: MeasurementTypeInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    unit: v.unit && v.unit !== "None" ? v.unit : null,
    notes: v.notes?.trim() ? v.notes.trim() : null,
  };

  if (v.id) {
    const { error } = await supabase.from("measurement_types").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/measurement-types");
    return { ok: true, id: v.id };
  }

  // New type goes to the end of the manual sort order.
  const { data: maxRow } = await supabase
    .from("measurement_types")
    .select("sort_order")
    .eq("gym_id", profile.gymId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("measurement_types")
    .insert({ gym_id: profile.gymId, sort_order: sortOrder, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/measurement-types");
  return { ok: true, id: data.id as string };
}

/** Soft-delete (is_active = false). Hard delete would cascade client measurement values. */
export async function deleteMeasurementType(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("measurement_types")
    .update({ is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/measurement-types");
  return { ok: true, id };
}

export async function restoreMeasurementType(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("measurement_types")
    .update({ is_active: true })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/measurement-types");
  return { ok: true, id };
}
