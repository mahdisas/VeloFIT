"use client";

import * as React from "react";
import { Direction } from "radix-ui";

import { type Dictionary, type Locale, dirFor, translate } from "./config";

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

/**
 * Provides the active locale + dictionary to client components. The dictionary
 * for the active locale only is passed from the server (root layout), so the
 * other locales' dictionaries never reach the client bundle.
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, t: (key, vars) => translate(dict, key, vars) }),
    [locale, dict]
  );
  // DirectionProvider makes every Radix primitive (Select, Dropdown, etc.) honor
  // the active locale's direction, so RTL selects align their value + chevron +
  // check correctly instead of defaulting to LTR.
  return (
    <I18nContext.Provider value={value}>
      <Direction.Provider dir={dirFor(locale)}>{children}</Direction.Provider>
    </I18nContext.Provider>
  );
}

function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  // Fallback so components used outside the provider (or in tests) still render
  // English instead of crashing.
  return ctx ?? { locale: "en", t: (key) => key };
}

/** `const t = useT(); t("Save")` — translate a string in a client component. */
export function useT() {
  return useI18n().t;
}

/** The active locale (e.g. for `dir`-aware logic in a client component). */
export function useLocale() {
  return useI18n().locale;
}
