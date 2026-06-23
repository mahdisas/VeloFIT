"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/** Campaign mutations. gym_id from the authed profile; RLS-scoped. */

export type CampaignInput = {
  id?: string;
  name: string;
  platformType: string;
  campaignType: string;
  url?: string;
  description?: string;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  platformType: z.string().min(1, "Platform type is required"),
  campaignType: z.string().min(1, "Campaign type is required"),
  url: z.string().optional(),
  description: z.string().optional(),
});

export async function saveCampaign(input: CampaignInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name.trim(),
    platform_type: v.platformType,
    campaign_type: v.campaignType,
    url: v.url?.trim() ? v.url.trim() : null,
    description: v.description?.trim() ? v.description.trim() : null,
  };

  if (v.id) {
    const { error } = await supabase.from("campaigns").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/marketing/campaigns");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase.from("campaigns").insert({ gym_id: profile.gymId, ...row }).select("id").single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/marketing/campaigns");
  return { ok: true, id: data.id as string };
}

/** Soft-delete (is_active = false) — keeps lead attribution (leads.campaign_id). */
export async function deleteCampaign(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("campaigns").update({ is_active: false }).eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/marketing/campaigns");
  return { ok: true, id };
}
