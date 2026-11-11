/**
 * What needs the couple's attention on their guests, most pressing first.
 * The root of the Guests hub shows these as cards; everything else lives in
 * the modules. Pure, so the native app can reuse it if it restarts.
 */

export type AttentionGuest = {
  email?: string | null;
  seating_table_id?: string | null;
  rsvp_reminder_sent_at?: string | null;
  rsvps?: { status?: string | null } | null;
};

export type AttentionItem =
  /** Guests still waiting who have an email: nudge them. `recentDays` is set
   *  when every one of them was nudged in the last week (days since the
   *  latest nudge), so the card can stay calm instead of pressing again. */
  | { kind: "nudge"; waiting: number; withEmail: number; recentDays: number | null }
  /** Waiting guests with no email: their link has to go another way. */
  | { kind: "noEmail"; count: number }
  | { kind: "duplicates"; count: number }
  /** Coming but not on the seating plan, once a plan has tables. */
  | { kind: "unseated"; count: number }
  | { kind: "maybe"; count: number };

/** A nudge less than this many days old counts as recent. */
export const RECENT_NUDGE_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

function statusOf(g: AttentionGuest): string {
  return g.rsvps?.status ?? "pending";
}

export function guestAttention(
  guests: readonly AttentionGuest[],
  context: { duplicateGroups: number; seatingTables: number; now?: Date },
): AttentionItem[] {
  const now = (context.now ?? new Date()).getTime();
  const waiting = guests.filter((g) => statusOf(g) === "pending");
  const reachable = waiting.filter((g) => !!g.email);
  const unreachable = waiting.length - reachable.length;
  const maybe = guests.filter((g) => statusOf(g) === "maybe").length;
  const unseated =
    context.seatingTables > 0
      ? guests.filter((g) => statusOf(g) === "attending" && !g.seating_table_id).length
      : 0;

  // Days since each reachable guest's last nudge; null when never nudged.
  const ages = reachable.map((g) => {
    const t = g.rsvp_reminder_sent_at ? new Date(g.rsvp_reminder_sent_at).getTime() : NaN;
    return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / DAY));
  });
  const allRecent =
    ages.length > 0 && ages.every((a) => a !== null && a < RECENT_NUDGE_DAYS);
  const recentDays = allRecent ? Math.min(...(ages as number[])) : null;

  const pressing: AttentionItem[] = [];
  const calm: AttentionItem[] = [];
  if (reachable.length > 0) {
    const item: AttentionItem = {
      kind: "nudge",
      waiting: waiting.length,
      withEmail: reachable.length,
      recentDays,
    };
    (allRecent ? calm : pressing).push(item);
  }
  if (unreachable > 0) pressing.push({ kind: "noEmail", count: unreachable });
  if (context.duplicateGroups > 0) pressing.push({ kind: "duplicates", count: context.duplicateGroups });
  if (unseated > 0) pressing.push({ kind: "unseated", count: unseated });
  if (maybe > 0) calm.push({ kind: "maybe", count: maybe });
  return [...pressing, ...calm];
}
