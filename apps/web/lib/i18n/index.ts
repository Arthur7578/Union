import { en, type Dictionary } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

export type Locale = "en" | "fr";
export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";

export const dictionaries: Record<Locale, Dictionary> = { en, fr };

/** Cookie name — set on the client when the user picks a language, read on the
 * server by the root layout so the first render matches their choice. */
export const LOCALE_COOKIE = "union.locale";

/** Pick the best-matching locale for an `Accept-Language` header value.
 * We only match on the primary language subtag ("fr-CA" → "fr"). */
export function pickLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  if (!header) return DEFAULT_LOCALE;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";");
      const q = rest.find((s) => s.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1] ?? "1") : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(quality) ? quality : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of candidates) {
    const primary = tag.split("-")[0] as Locale;
    if (LOCALES.includes(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type { Dictionary };
