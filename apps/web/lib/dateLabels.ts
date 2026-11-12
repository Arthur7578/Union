import type { Locale } from "@/lib/i18n";

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-US");

/**
 * The time zone a form's dates are picked and read in. Fixed for now: every
 * wedding on Union is in France. Showing them in each device's own zone made
 * the server and the phone disagree on the day. A zone per wedding: issue #116.
 */
export const FORM_TIME_ZONE = "Europe/Paris";

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * "12 mai" / "May 12". A plain day ("YYYY-MM-DD") is that day; a timestamp is
 * the day it falls on in Paris. Null without a date.
 */
export function shortDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const at = isDay(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(tag(locale), {
    day: "numeric",
    month: "long",
    timeZone: isDay(value) ? "UTC" : FORM_TIME_ZONE,
  });
}

/**
 * The last day guests can reply, from a form's closing time: "12 mai" for a
 * form that closes on the 12th at 23:59:59. A closing saved before the day
 * was included (the start of a day) names the day before, the real last one.
 */
export function closingDay(closesAt: string | null | undefined, locale: Locale): string | null {
  if (!closesAt) return null;
  const at = new Date(closesAt);
  if (Number.isNaN(at.getTime())) return null;
  return shortDate(new Date(at.getTime() - 1000).toISOString(), locale);
}

/** "Samedi 12 juin" / "Saturday, June 12", capitalised, from "YYYY-MM-DD". */
export function dayLabel(iso: string, locale: Locale): string {
  const label = new Date(`${iso}T00:00:00`).toLocaleDateString(tag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "YYYY-MM-DD" of an instant, in Paris. */
function parisDay(at: Date): string {
  // en-CA formats a date as YYYY-MM-DD.
  return at.toLocaleDateString("en-CA", { timeZone: FORM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
}

/** The instant a day starts in Paris. */
function parisDayStart(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  // Paris is one or two hours ahead of UTC: try both, keep the one that lands on the day.
  for (const hoursAhead of [1, 2]) {
    const at = new Date(Date.UTC(y, m - 1, d, -hoursAhead));
    const clock = at.toLocaleTimeString("en-GB", { timeZone: FORM_TIME_ZONE, hour12: false });
    if (parisDay(at) === value && clock.startsWith("00:00")) return at;
  }
  return new Date(Date.UTC(y, m - 1, d, -1));
}

/** Which of a form's two dates: it opens at the start of its day, and closes
 *  at the end of its day (that day included). */
export type FormDateKind = "opens" | "closes";

/** A stored timestamp as the value of a date field ("YYYY-MM-DD"): the day
 *  the organiser picked, in Paris time. */
export function toDateInput(iso: string | null | undefined, kind: FormDateKind): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return parisDay(kind === "closes" ? new Date(at.getTime() - 1000) : at);
}

/** A date field's value as the timestamp to store. */
export function fromDateInput(value: string, kind: FormDateKind): string | null {
  if (!isDay(value)) return null;
  const start = parisDayStart(value);
  if (kind === "opens") return start.toISOString();
  // The last second of the day: the start of the next day, minus one second.
  const next = new Date(start.getTime() + 36 * 3600 * 1000);
  return new Date(parisDayStart(parisDay(next)).getTime() - 1000).toISOString();
}
