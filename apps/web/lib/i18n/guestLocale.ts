import { DEFAULT_LOCALE, isLocale, type Locale } from "./index";

/**
 * Which language a guest reads their invitation in.
 *
 * Four signals can have an opinion, and they are not equal. Ranked strongest
 * first, so that a real fact about the person reading always beats a guess
 * made on their behalf:
 *
 *  1. **`deviceChoice`** — they used the language switcher in this browser.
 *  2. **`guestChoice`** — they used it on some other device, and we recorded
 *     it against their invitation. Both are the guest speaking for
 *     themselves, so both come first; the local one wins between them only
 *     because it's the more recent of the two.
 *  3. **`organiserOverride`** — the couple filled in the Language field for
 *     this guest. A deliberate statement about one person, but still someone
 *     else's assumption, so a guest can always overrule it.
 *  4. **`detected`** — their browser's `Accept-Language`. Weaker than a
 *     stated preference, stronger than a wedding-wide default: it's about
 *     this reader.
 *  5. **`weddingDefault`** — the language the couple writes their content in.
 *     The floor, not the starting point: it decides only when nothing at all
 *     is known about the guest.
 *
 * Everything is accepted as a loose `string | null` because most of these
 * arrive from jsonb columns; anything that isn't a locale this app ships is
 * treated as absent rather than trusted.
 */
export type GuestLocaleSignals = {
  /** Language picked with the switcher in this browser (the locale cookie). */
  deviceChoice?: string | null;
  /** Language the guest picked themselves, recorded server-side. */
  guestChoice?: string | null;
  /** The couple's per-guest Language override. */
  organiserOverride?: string | null;
  /** Match from the browser's `Accept-Language`, or null when it asked for
   *  nothing this app ships. */
  detected?: string | null;
  /** The wedding's default language. */
  weddingDefault?: string | null;
};

/** Which signal actually decided — useful for explaining the outcome in the
 *  organiser UI, and what the tests assert on. `"fallback"` means not one of
 *  the five said anything usable. */
export type GuestLocaleSource =
  | "deviceChoice"
  | "guestChoice"
  | "organiserOverride"
  | "detected"
  | "weddingDefault"
  | "fallback";

const RANKING: readonly Exclude<GuestLocaleSource, "fallback">[] = [
  "deviceChoice",
  "guestChoice",
  "organiserOverride",
  "detected",
  "weddingDefault",
];

/** The language to open a guest's invitation in, and why. */
export function resolveGuestLocale(signals: GuestLocaleSignals): {
  locale: Locale;
  source: GuestLocaleSource;
} {
  for (const source of RANKING) {
    const value = signals[source];
    if (isLocale(value)) return { locale: value, source };
  }
  return { locale: DEFAULT_LOCALE, source: "fallback" };
}

/** Just the language. Shorthand for the common case. */
export function guestLocale(signals: GuestLocaleSignals): Locale {
  return resolveGuestLocale(signals).locale;
}
