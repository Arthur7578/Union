import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { en, type Dictionary } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

export type Locale = "en" | "fr";
export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";
const STORAGE_KEY = "union.locale";

const dictionaries: Record<Locale, Dictionary> = { en, fr };

/** Read the device's preferred language from the platform, best-effort. Falls
 * back to English if nothing usable is exposed. We only need the primary
 * language subtag ("fr-CA" → "fr"). */
function detectDeviceLocale(): Locale {
  try {
    // Intl is available on Hermes and gives us a reliable BCP-47 tag.
    const tag =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().locale
        : "";
    if (tag) {
      const primary = tag.toLowerCase().split("-")[0];
      if ((LOCALES as string[]).includes(primary)) return primary as Locale;
    }
  } catch {
    // fall through
  }

  // Fallback to native modules when Intl doesn't help.
  try {
    let raw = "";
    if (Platform.OS === "ios") {
      raw =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        "";
    } else {
      raw = NativeModules.I18nManager?.localeIdentifier ?? "";
    }
    const primary = String(raw).toLowerCase().split(/[-_]/)[0];
    if ((LOCALES as string[]).includes(primary)) return primary as Locale;
  } catch {
    // fall through
  }
  return DEFAULT_LOCALE;
}

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
  locales: readonly Locale[];
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Wraps the app so any component can read the current locale + dictionary.
 * Loads the persisted choice from AsyncStorage on mount, so the switcher
 * survives cold starts. First-run picks the device language. */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDeviceLocale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === "en" || stored === "fr")) {
          setLocaleState(stored);
        }
      } catch {
        // Storage unavailable — device-detected locale stays in play.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Fire-and-forget: a persistence failure isn't worth interrupting the user.
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE],
      setLocale,
      locales: LOCALES,
    }),
    [locale, setLocale],
  );

  // Once we've read the persisted choice we render normally. Before hydration
  // we render with the device-detected locale — nothing depends on the two
  // rendering identically since the app is fully client-side.
  void hydrated;

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    t: dictionaries[DEFAULT_LOCALE],
    setLocale: () => {},
    locales: LOCALES,
  };
}

export function useT(): Dictionary {
  return useLocale().t;
}

/** BCP-47 tag for Intl formatting. */
export function intlTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}
