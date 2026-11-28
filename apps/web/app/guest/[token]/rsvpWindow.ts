import type { RsvpWindow } from "./ReplySection";

/**
 * Where the RSVP stands for guests, from its publication and its dates: not
 * shown (unpublished), not open yet, open, or closed. The form refuses
 * answers outside this window, so the page never offers one there.
 */
export function rsvpWindowOf(
  form: { published?: boolean | null; opens_at?: string | null; closes_at?: string | null } | null | undefined,
  now: Date = new Date(),
): RsvpWindow {
  if (form?.published === false) return "hidden";
  if (form?.opens_at && new Date(form.opens_at) > now) return "scheduled";
  if (form?.closes_at && new Date(form.closes_at) < now) return "closed";
  return "live";
}
