/**
 * SMS Settings types (Settings · SMS Settings). Gym-wide automated-SMS
 * configuration: a daily send time plus trigger toggles (birthday, subscription
 * expiry, remaining entrances, joining), each with its own template ({{1}} =
 * client name). Stored in the real public.sms_settings table (one row per gym);
 * reads/writes live in lib/settings/sms-settings-server.ts and the matching actions.
 *
 * PHASE 2: there is no SMS provider yet, so these settings are saved but never
 * trigger a send — the form's toggles are disabled in the UI.
 */

/** "HH:MM" options for the daily send-time picker (every hour). */
export const SEND_TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export type SmsSettings = {
  sendAt: string;
  birthdayEnabled: boolean;
  birthdayMessage: string;
  expirySameDayEnabled: boolean;
  expirySameDayMessage: string;
  expiryBeforeEnabled: boolean;
  expiryBeforeDays: number;
  expiryBeforeMessage: string;
  entrancesLeftEnabled: boolean;
  entrancesLeftCount: number;
  entrancesLeftMessage: string;
  joiningEnabled: boolean;
  joiningMessage: string;
};

// getSmsSettings() is a real, RLS-scoped query — see
// lib/settings/sms-settings-server.ts.
