"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  getDictionary,
  type Dictionary,
  type Locale,
} from "./index";

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
  locales: readonly Locale[];
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function writeCookieLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  // 1 year, root path, SameSite=Lax so the server sees it on same-site requests.
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
    locale,
  )}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    writeCookieLocale(next);
    setLocaleState(next);
    // Update <html lang> so the browser (and screen readers) reflect it live.
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      setLocale,
      locales: LOCALES,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/** Access the current locale + dictionary. Safe outside a provider — falls
 * back to the default locale, so a stray leaf component doesn't crash. */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    t: getDictionary(DEFAULT_LOCALE),
    setLocale: () => {},
    locales: LOCALES,
  };
}

/** Shorthand — most components just want the strings. */
export function useT(): Dictionary {
  return useLocale().t;
}
