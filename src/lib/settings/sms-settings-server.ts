import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type SmsSettings } from "@/lib/settings/sms-settings";

const DEFAULTS: SmsSettings = {
  sendAt: "16:00",
  birthdayEnabled: false,
  birthdayMessage: "",
  expirySameDayEnabled: false,
  expirySameDayMessage: "",
  expiryBeforeEnabled: false,
  expiryBeforeDays: 3,
  expiryBeforeMessage: "",
  entrancesLeftEnabled: false,
  entrancesLeftCount: 3,
  entrancesLeftMessage: "",
  joiningEnabled: false,
  joiningMessage: "",
};

/** The gym's single SMS-settings row, or sensible defaults when unset. */
export async function getSmsSettings(): Promise<SmsSettings> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("sms_settings")
    .select("*")
    .eq("gym_id", profile.gymId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load SMS settings: ${error.message}`);
  if (!data) return DEFAULTS;

  return {
    sendAt: String(data.send_at).slice(0, 5),
    birthdayEnabled: data.birthday_enabled,
    birthdayMessage: data.birthday_message ?? "",
    expirySameDayEnabled: data.expiry_same_day_enabled,
    expirySameDayMessage: data.expiry_same_day_message ?? "",
    expiryBeforeEnabled: data.expiry_before_enabled,
    expiryBeforeDays: data.expiry_before_days,
    expiryBeforeMessage: data.expiry_before_message ?? "",
    entrancesLeftEnabled: data.entrances_left_enabled,
    entrancesLeftCount: data.entrances_left_count,
    entrancesLeftMessage: data.entrances_left_message ?? "",
    joiningEnabled: data.joining_enabled,
    joiningMessage: data.joining_message ?? "",
  };
}
