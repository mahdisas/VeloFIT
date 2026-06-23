"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { type SmsSettings } from "@/lib/settings/sms-settings";

/** Upsert the single per-gym SMS-settings row (PK = gym_id). */

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  sendAt: z.string().regex(/^\d{2}:\d{2}$/, "Invalid send time"),
  birthdayEnabled: z.boolean(),
  birthdayMessage: z.string(),
  expirySameDayEnabled: z.boolean(),
  expirySameDayMessage: z.string(),
  expiryBeforeEnabled: z.boolean(),
  expiryBeforeDays: z.number().int().min(1),
  expiryBeforeMessage: z.string(),
  entrancesLeftEnabled: z.boolean(),
  entrancesLeftCount: z.number().int().min(1),
  entrancesLeftMessage: z.string(),
  joiningEnabled: z.boolean(),
  joiningMessage: z.string(),
});

export async function saveSmsSettings(input: SmsSettings): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase.from("sms_settings").upsert(
    {
      gym_id: profile.gymId,
      send_at: v.sendAt,
      birthday_enabled: v.birthdayEnabled,
      birthday_message: v.birthdayMessage,
      expiry_same_day_enabled: v.expirySameDayEnabled,
      expiry_same_day_message: v.expirySameDayMessage,
      expiry_before_enabled: v.expiryBeforeEnabled,
      expiry_before_days: v.expiryBeforeDays,
      expiry_before_message: v.expiryBeforeMessage,
      entrances_left_enabled: v.entrancesLeftEnabled,
      entrances_left_count: v.entrancesLeftCount,
      entrances_left_message: v.entrancesLeftMessage,
      joining_enabled: v.joiningEnabled,
      joining_message: v.joiningMessage,
    },
    { onConflict: "gym_id" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/sms-settings");
  return { ok: true };
}
