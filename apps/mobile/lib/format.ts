/** Shared formatting/validation helpers. */

import type { Locale } from "./i18n";

function intlTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

/** True when `value` is a valid YYYY-MM-DD calendar date. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
}

/** "2026-09-12" -> a long, human date in the given locale.
 *  Second arg defaults to English so existing callers still typecheck. */
export function formatLongDate(
  iso: string | null,
  locale: Locale = "en",
): string {
  if (!iso) return locale === "fr" ? "Date à définir" : "Date to be decided";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlTag(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Whole days from today until `iso` (negative if in the past). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ms = d.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
