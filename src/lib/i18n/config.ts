/**
 * i18n configuration — client-safe (no server imports), so both server and
 * client code can use it.
 *
 * Strategy: the ENGLISH source string is the dictionary key. `t("Dashboard")`
 * looks "Dashboard" up in the active locale's dictionary and falls back to the
 * key itself when missing. This means English is always the baseline, untranslated
 * strings degrade gracefully (they show in English), and adding a translation is
 * just adding a map entry — no separate key catalog to keep in sync.
 */

export const LOCALES = ["en", "ar", "he"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Right-to-left locales. */
export const RTL_LOCALES: readonly Locale[] = ["ar", "he"];

/** Cookie that persists the chosen locale (read server-side in the root layout). */
export const LOCALE_COOKIE = "velofit_locale";

/** Native names shown in the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  he: "עברית",
};

export type Dictionary = Record<string, string>;

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/** Look up `key` in `dict`, falling back to the key (English source) when absent. */
export function translate(dict: Dictionary, key: string, vars?: Record<string, string | number>): string {
  let out = dict[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }
  return out;
}
