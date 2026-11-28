import type { Dictionary, Locale } from "@/lib/i18n";
import { closingDay, shortDate } from "@/lib/dateLabels";

type RsvpDates = { published?: boolean | null; opens_at?: string | null; closes_at?: string | null };
type ModulesCopy = Dictionary["guests"]["modules"];

/** Where the RSVP stands for guests: the same window the page uses. */
export type RsvpState = "draft" | "scheduled" | "live" | "closed";

/**
 * The "Your reply" row of Guests › Guest experience: where the RSVP stands,
 * whether guests can reply now, and so whether its link is about the dates.
 * Null form (still loading, or none): the reply is simply always there.
 */
export function organiserRsvpStatus(
  form: RsvpDates | null,
  state: RsvpState | null,
  locale: Locale,
  t: ModulesCopy,
): { text: string; tone: "on" | "warn"; blocked: boolean } {
  switch (state) {
    case "closed":
      return { text: t.replyClosed(closingDay(form?.closes_at, locale) ?? ""), tone: "warn", blocked: true };
    case "scheduled":
      return { text: t.replyScheduled(shortDate(form?.opens_at, locale) ?? ""), tone: "warn", blocked: true };
    case "draft":
      return { text: t.replyDraft, tone: "warn", blocked: true };
    case "live":
      return { text: t.replyOpen(closingDay(form?.closes_at, locale)), tone: "on", blocked: false };
    default:
      return { text: t.always, tone: "on", blocked: false };
  }
}

/**
 * In the organiser's "see as a guest" preview, why the RSVP card offers
 * nothing to press; null while guests can reply.
 */
export function previewRsvpNote(
  window: "hidden" | "scheduled" | "live" | "closed",
  form: RsvpDates | null | undefined,
  locale: Locale,
  t: ModulesCopy,
): string | null {
  if (window === "closed") return t.previewRsvpClosed(closingDay(form?.closes_at, locale) ?? "");
  if (window === "scheduled") return t.previewRsvpScheduled(shortDate(form?.opens_at, locale) ?? "");
  if (window === "hidden") return t.previewRsvpDraft;
  return null;
}
