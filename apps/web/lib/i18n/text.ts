import {
  resolveText as resolveStoredText,
  type StoredText,
} from "@union/shared";
import { DEFAULT_LOCALE, LOCALES, getDictionary, type Locale } from "./index";

/**
 * Reading the couple's own guest-facing copy, bound to the locales this app
 * actually ships.
 *
 * `resolveText` in @union/shared is deliberately locale-list-agnostic; these
 * wrappers pin the fallback order to LOCALES so every screen degrades the same
 * way: the guest's language first, then English, then anything the couple
 * happened to write. A guest never sees a blank headline because one locale
 * was left empty.
 */

/** The couple's text for this locale, or undefined if they wrote none. */
export function coupleText(
  value: StoredText,
  locale: Locale,
): string | undefined {
  return resolveStoredText(value, locale, LOCALES);
}

/** The couple's text for this locale, falling back to a system default. */
export function coupleTextOr(
  value: StoredText,
  locale: Locale,
  fallback: string,
): string {
  return coupleText(value, locale) ?? fallback;
}

type RsvpPurpose = "primary" | "reconfirmation";

/** System default wording for an RSVP block, in the reader's language.
 *  Both the guest portal and the builder's preview go through here, so the
 *  preview can't drift from what a guest actually sees. */
export function rsvpDefaults(locale: Locale, purpose: RsvpPurpose) {
  const t = getDictionary(locale).formDefaults.rsvp;
  const primary = t.primary;
  if (purpose === "reconfirmation") {
    return {
      title: t.reconfirmation.title,
      subtitle: t.reconfirmation.subtitle,
      // A reconfirmation reuses the primary block's reply buttons, so it has
      // no labels of its own to default.
      labelAttending: primary.labelAttending,
      labelMaybe: primary.labelMaybe,
      labelDeclined: primary.labelDeclined,
    };
  }
  return primary;
}

export { DEFAULT_LOCALE, LOCALES };
export type { Locale };
