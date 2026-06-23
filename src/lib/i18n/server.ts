import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale, translate } from "./config";
import { getDict } from "./dictionaries";

/** The caller's chosen locale (from the cookie), defaulting to English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** `const t = await getT(); t("Save")` — translate in a server component. */
export async function getT(locale?: Locale) {
  const loc = locale ?? (await getLocale());
  const dict = getDict(loc);
  return (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars);
}
