import type { Locale } from "@/lib/i18n";

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-US");

/** "12 mai" / "May 12", from an ISO date or timestamp; null without one. */
export function shortDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(tag(locale), { day: "numeric", month: "long" });
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

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A stored timestamp as the value of a date field ("YYYY-MM-DD"), in the
 * organiser's own time zone: the day they picked, not the UTC day it falls on.
 */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A date field's value as a timestamp: the start of that day, local time. */
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}
