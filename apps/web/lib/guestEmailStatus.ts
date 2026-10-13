import type { Guest } from "@union/shared";

/**
 * What the couple can rely on for a guest's email, as shown on the guest's
 * page: confirmed (the guest proved they receive mail there), or not yet,
 * and in that case who entered it.
 */
export type GuestEmailStatus =
  | "confirmed"
  | "organiserUnconfirmed"
  | "guestUnconfirmed"
  | "none";

export function guestEmailStatus(
  guest: Pick<Guest, "email" | "email_source" | "email_confirmed_at">,
): GuestEmailStatus {
  if (!guest.email?.trim()) return "none";
  if (guest.email_confirmed_at) return "confirmed";
  return guest.email_source === "guest" ? "guestUnconfirmed" : "organiserUnconfirmed";
}
