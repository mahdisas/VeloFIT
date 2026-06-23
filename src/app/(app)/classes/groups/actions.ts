"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Class Groups mutations. Each write derives gym_id from the authed profile;
 * RLS independently scopes to the gym. saveGroup upserts the class_groups row
 * and replaces its class_group_classes links in one pass.
 */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const price = z.number().min(0);
const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  classIds: z.array(z.string()),
  price1m: price,
  price2m: price,
  price3m: price,
  price4m: price,
  price6m: price,
  priceYearly: price,
  notes: z.string(),
});

export type GroupInput = z.infer<typeof schema>;

export async function saveGroup(input: GroupInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    notes: v.notes.trim() ? v.notes.trim() : null,
    price_1m: v.price1m,
    price_2m: v.price2m,
    price_3m: v.price3m,
    price_4m: v.price4m,
    price_6m: v.price6m,
    price_yearly: v.priceYearly,
  };

  // Duplicate name per gym → unique index class_groups_gym_name_uidx (23505).
  const dupMessage = "A group with this name already exists.";

  let groupId = v.id;
  if (groupId) {
    const { error } = await supabase.from("class_groups").update(row).eq("id", groupId).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.code === "23505" ? dupMessage : error.message };
  } else {
    const { data, error } = await supabase
      .from("class_groups")
      .insert({ gym_id: profile.gymId, ...row })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.code === "23505" ? dupMessage : error.message };
    groupId = data.id as string;
  }

  // Replace the group ↔ classes links wholesale.
  const { error: delError } = await supabase
    .from("class_group_classes")
    .delete()
    .eq("group_id", groupId)
    .eq("gym_id", profile.gymId);
  if (delError) return { ok: false, error: delError.message };

  if (v.classIds.length) {
    const links = v.classIds.map((classId) => ({ gym_id: profile.gymId, group_id: groupId, class_id: classId }));
    const { error: insError } = await supabase.from("class_group_classes").insert(links);
    if (insError) return { ok: false, error: insError.message };
  }

  revalidatePath("/classes/groups");
  return { ok: true, id: groupId };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("class_groups")
    .update({ is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/classes/groups");
  return { ok: true, id };
}

export async function restoreGroup(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("class_groups")
    .update({ is_active: true })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/classes/groups");
  return { ok: true, id };
}
