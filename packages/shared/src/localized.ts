/**
 * Localized free text — the couple writes it, guests read it in their own
 * language.
 *
 * Every guest-facing string the couple authors (an RSVP headline, a reply
 * button label, a question title, one of its options) is stored as a map of
 * locale → text rather than a single string, so the same form can greet an
 * English guest with "Your presence" and a French one with "Votre présence".
 *
 * Two things make this shape survive contact with real data:
 *
 *  * **Legacy tolerance.** Rows written before this existed hold a bare
 *    string. Every reader here accepts `string | LocalizedText`, so the app
 *    behaves identically whether or not the normalising migration has run —
 *    a deploy can't outrun its migration and blank out a guest's invitation.
 *
 *  * **Metadata under a non-locale key.** Machine translations are tracked in
 *    `$auto` so the builder can flag them for review. Readers only ever
 *    consider keys that look like locales, so metadata can never leak into
 *    guest-facing copy.
 */

/** Marks which locales hold machine-generated text awaiting a human read. */
export const AUTO_TRANSLATED_KEY = "$auto";

/** Locale → text, plus the `$auto` review marker. Locale keys are BCP-47-ish
 *  ("en", "fr", "pt-BR") — anything else is metadata and never rendered. */
export type LocalizedText = {
  [locale: string]: string | string[] | undefined;
  [AUTO_TRANSLATED_KEY]?: string[];
};

/** What actually comes back from jsonb: the localized map, or a bare string
 *  from before the migration, or nothing at all. */
export type StoredText = string | LocalizedText | null | undefined;

/** A locale key we're willing to render — two letters, optional region. */
export function isLocaleKey(key: string): boolean {
  return /^[a-z]{2}(-[A-Za-z0-9]{2,8})*$/.test(key);
}

function trimmedOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Normalise any stored value into a locale map. A bare legacy string lands
 *  under `sourceLocale` — that's a guess about text written before we asked
 *  the couple which language they were writing in, and it's why readers fall
 *  back across every locale rather than trusting the key. */
export function toLocalizedText(
  value: StoredText,
  sourceLocale: string,
): LocalizedText {
  if (typeof value === "string") {
    const text = trimmedOrUndefined(value);
    return text ? { [sourceLocale]: text } : {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: LocalizedText = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === AUTO_TRANSLATED_KEY) {
      if (Array.isArray(raw)) {
        const locales = raw.filter(
          (l): l is string => typeof l === "string" && isLocaleKey(l),
        );
        if (locales.length) out[AUTO_TRANSLATED_KEY] = locales;
      }
      continue;
    }
    if (!isLocaleKey(key)) continue;
    const text = trimmedOrUndefined(raw);
    if (text) out[key] = text;
  }
  return out;
}

/**
 * The text to show a guest reading in `locale`, or undefined when the couple
 * has written nothing anywhere — the caller's cue to use its own localized
 * system default.
 *
 * Falls back rather than blanking out: the guest's locale, then each locale in
 * `fallbackLocales` (the app's supported list, most-preferred first), then any
 * other locale present. Something the couple wrote always beats showing
 * nothing, even in the wrong language.
 */
export function resolveText(
  value: StoredText,
  locale: string,
  fallbackLocales: readonly string[] = [],
): string | undefined {
  if (typeof value === "string") return trimmedOrUndefined(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const direct = trimmedOrUndefined(value[locale]);
  if (direct) return direct;
  for (const fallback of fallbackLocales) {
    const text = trimmedOrUndefined(value[fallback]);
    if (text) return text;
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!isLocaleKey(key)) continue;
    const text = trimmedOrUndefined(raw);
    if (text) return text;
  }
  return undefined;
}

/** The couple's own text for exactly `locale` — no fallback. This is what the
 *  builder binds its inputs to, so an empty French field reads as empty and
 *  shows its placeholder instead of silently echoing the English. */
export function textForLocale(
  value: StoredText,
  locale: string,
): string {
  if (typeof value === "string") return "";
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = value[locale];
  // Returned untrimmed on purpose — this feeds a controlled input, and
  // trimming here would fight the couple every time they type a space.
  return typeof raw === "string" ? raw : "";
}

/** Write one locale's text, dropping it from the `$auto` review list — a hand
 *  edit means a human has now vouched for this wording. */
export function setTextForLocale(
  value: StoredText,
  locale: string,
  text: string,
  sourceLocale = locale,
): LocalizedText {
  const next = toLocalizedText(value, sourceLocale);
  const trimmed = text.trim();
  if (trimmed) next[locale] = text;
  else delete next[locale];
  return clearAutoFlag(next, locale);
}

/** Write one locale's text and mark it as machine-generated. */
export function setAutoTextForLocale(
  value: StoredText,
  locale: string,
  text: string,
  sourceLocale = locale,
): LocalizedText {
  const next = toLocalizedText(value, sourceLocale);
  const trimmed = text.trim();
  if (!trimmed) return clearAutoFlag(next, locale);
  next[locale] = text;
  const flagged = new Set(next[AUTO_TRANSLATED_KEY] ?? []);
  flagged.add(locale);
  next[AUTO_TRANSLATED_KEY] = [...flagged];
  return next;
}

function clearAutoFlag(value: LocalizedText, locale: string): LocalizedText {
  const flagged = (value[AUTO_TRANSLATED_KEY] ?? []).filter((l) => l !== locale);
  if (flagged.length) value[AUTO_TRANSLATED_KEY] = flagged;
  else delete value[AUTO_TRANSLATED_KEY];
  return value;
}

/** Whether this locale's text was machine-generated and not since hand-edited. */
export function isAutoTranslated(value: StoredText, locale: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value[AUTO_TRANSLATED_KEY] ?? []).includes(locale);
}

/** True when the couple has written nothing in any locale. */
export function isTextEmpty(value: StoredText): boolean {
  return resolveText(value, "") === undefined;
}
