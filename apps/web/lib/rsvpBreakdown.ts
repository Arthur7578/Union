import { rollUpRsvps } from "@union/shared";
import type { GuestWithRsvp } from "./data";

/** How a set of guests has replied — the little dots on a group. */
export type RsvpBreakdown = {
  attending: number;
  maybe: number;
  declined: number;
  pending: number;
};

/** Tally a group's replies. A guest with no reply on file is still pending. */
export function breakdownFor(members: GuestWithRsvp[]): RsvpBreakdown {
  const { coming, maybe, declined, waiting } = rollUpRsvps(
    members.map((m) => m.rsvps?.status ?? "pending"),
  );
  return { attending: coming, maybe, declined, pending: waiting };
}
