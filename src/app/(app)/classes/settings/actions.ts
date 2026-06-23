"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { type ClassSettings } from "@/lib/class-settings";

/**
 * Persist class settings into gyms.settings->'classes'. We read the current
 * settings, merge the `classes` key, and write back. RLS limits gym updates to
 * owners/admins, so a 0-row result means the caller isn't permitted.
 */

const schema = z.object({
  convertWaitingToApproved: z.boolean(),
  notifyOnCancellation: z.boolean(),
  reminderMinutesBefore: z.number().int().min(0),
  showClassesEveryWeek: z.boolean(),
  scheduleNextDays: z.number().int().min(1),
  applyEnrollmentLimitAcrossSubscriptions: z.boolean(),
  blockClientsForAbsences: z.boolean(),
});

export async function saveClassSettings(
  settings: ClassSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(settings);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data: gym, error: readError } = await supabase
    .from("gyms")
    .select("settings")
    .eq("id", profile.gymId)
    .single();
  if (readError) return { ok: false, error: readError.message };

  const merged = { ...((gym?.settings as Record<string, unknown>) ?? {}), classes: parsed.data };

  const { data: updated, error: updateError } = await supabase
    .from("gyms")
    .update({ settings: merged })
    .eq("id", profile.gymId)
    .select("id");
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "You don't have permission to change class settings." };
  }

  revalidatePath("/classes/settings");
  return { ok: true };
}
