import { type Dictionary, type Locale } from "../config";
import { ar } from "./ar";
import { he } from "./he";

/**
 * Active dictionary per locale. English is empty: English source strings are the
 * keys, so `translate()` falls back to them automatically.
 */
const DICTIONARIES: Record<Locale, Dictionary> = {
  en: {},
  ar,
  he,
};

export function getDict(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? {};
}
