import { en, type Dictionary } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

export type Locale = "en" | "fr";
export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";

export const dictionaries: Record<Locale, Dictionary> = { en, fr };

/** Cookie name — set on the client when the user picks a language, read on the
 * server by the root layout so the first render matches their choice. */
export const LOCALE_COOKIE = "union.locale";

/** The best-matching locale for an `Accept-Language` header value, or null
 * when the browser asked for nothing this app ships. We only match on the
 * primary language subtag ("fr-CA" → "fr").
 *
 * Returning null rather than the default is the point: "this reader's browser
 * asks for French" and "we know nothing about this reader" are different
 * facts, and guest-language ranking has to tell them apart — a real signal
 * about the guest outranks a wedding-wide fallback, and a non-answer doesn't.
 */
export function detectLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;
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
  return null;
}

/** Same, but answering "which language do we render in" — for screens with no
 * wedding behind them (sign-in, the marketing page), where the app default is
 * the only fallback there is. */
export function pickLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  return detectLocaleFromAcceptLanguage(header) ?? DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type { Dictionary };
