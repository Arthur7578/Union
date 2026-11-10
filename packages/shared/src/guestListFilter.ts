/**
 * Which guests a status filter and a search box let through, and the latest
 * replies — the logic behind the couple's guest list and the guests hub.
 * Kept free of the web so the native app can reuse it if it restarts.
 */

export type GuestStatusFilter = "all" | "coming" | "maybe" | "waiting" | "declined";

export const GUEST_STATUS_FILTERS: readonly GuestStatusFilter[] = [
  "all",
  "coming",
  "maybe",
  "waiting",
  "declined",
];

type RsvpStatusLike = "attending" | "maybe" | "declined" | "pending" | string;

export type FilterableGuest = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  guest_group?: string | null;
  role?: string | null;
  rsvps?: { status?: RsvpStatusLike | null; responded_at?: string | null } | null;
};

/** Reads a filter from a URL value; anything unknown is "all". */
export function parseGuestStatusFilter(value: string | null | undefined): GuestStatusFilter {
  return (GUEST_STATUS_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as GuestStatusFilter)
    : "all";
}

/** The status a guest counts under: no RSVP row yet means waiting. */
export function guestReplyStatus(guest: FilterableGuest): RsvpStatusLike {
  return guest.rsvps?.status ?? "pending";
}

function matchesStatus(guest: FilterableGuest, filter: GuestStatusFilter): boolean {
  const status = guestReplyStatus(guest);
  switch (filter) {
    case "coming":
      return status === "attending";
    case "maybe":
      return status === "maybe";
    case "waiting":
      return status === "pending";
    case "declined":
      return status === "declined";
    default:
      return true;
  }
}

/** Case- and accent-insensitive, so "lea" finds Léa. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filterGuests<G extends FilterableGuest>(
  guests: readonly G[],
  filter: GuestStatusFilter,
  query: string,
): G[] {
  const q = fold(query.trim());
  return guests.filter((g) => {
    if (!matchesStatus(g, filter)) return false;
    if (!q) return true;
    const hay = fold(
      [g.first_name, g.last_name, g.email, g.guest_group, g.role].filter(Boolean).join(" "),
    );
    return hay.includes(q);
  });
}

/** Guests who have replied, newest reply first, at most `limit`. */
export function latestReplies<G extends FilterableGuest>(guests: readonly G[], limit: number): G[] {
  return guests
    .filter((g) => guestReplyStatus(g) !== "pending" && !!g.rsvps?.responded_at)
    .sort((a, b) => b.rsvps!.responded_at!.localeCompare(a.rsvps!.responded_at!))
    .slice(0, Math.max(0, limit));
}
