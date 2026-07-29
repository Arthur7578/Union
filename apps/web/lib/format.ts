/** Formatting helpers shared across the planning app. */

import type { Locale } from "./i18n";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** BCP-47 tag we hand to Intl. */
function intlTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

/** Whole days from today until an ISO date (negative if in the past). */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Long date, e.g. "September 20, 2026" or "20 septembre 2026". */
export function formatLongDate(
  isoDate: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!isoDate) return locale === "fr" ? "Date à définir" : "Date to be set";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime()))
    return locale === "fr" ? "Date à définir" : "Date to be set";
  return d.toLocaleDateString(intlTag(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Short date, e.g. "Sept 20, 2026" or "20 sept. 2026". */
export function formatShortDate(
  isoDate: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!isoDate) return locale === "fr" ? "À définir" : "TBD";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime()))
    return locale === "fr" ? "À définir" : "TBD";
  return d.toLocaleDateString(intlTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Kicker line for the Today greeting — today's weekday and month. */
export function todayKicker(locale: Locale = "en"): string {
  const d = new Date();
  const tag = intlTag(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: "long" });
  const month = d.toLocaleDateString(tag, { month: "long" });
  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);
  // French renders lowercase weekdays and months; the kicker looks best titlecased.
  return `${capitalize(weekday)} · ${capitalize(month)} ${d.getDate()}`;
}

/** First name from a full name, falling back to a friendly default. */
export function firstName(
  full: string | null | undefined,
  locale: Locale = "en",
): string {
  const fallback = locale === "fr" ? "vous" : "there";
  if (!full) return fallback;
  return full.trim().split(/\s+/)[0] || fallback;
}

/** Initial letter (uppercase) for avatars. */
export function initial(name: string | null | undefined): string {
  if (!name) return "•";
  return name.trim().charAt(0).toUpperCase();
}

/** Locale-aware currency formatting. Defaults to USD for backwards compat. */
export function money(n: number, locale: Locale = "en"): string {
  if (locale === "fr") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Math.round(n));
  }
  return "$" + Math.round(n).toLocaleString("en-US");
}
