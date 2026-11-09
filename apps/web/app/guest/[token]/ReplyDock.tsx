"use client";

import { useLocale } from "@/lib/i18n/client";
import type { RsvpStatus } from "@/lib/submitRsvp";
import { shortDate } from "@/lib/dateLabels";
import type { RsvpWindow } from "./ReplySection";

/**
 * The reply, fixed at the bottom of the page, saying where the guest stands
 * and what they can do next:
 * - not answered yet: "Reply · by May 12";
 * - coming: their answer, and "Change";
 * - maybe: "Maybe · confirm by May 12", and "Confirm";
 * - not coming: their answer, and "Change my mind";
 * - replies closed: their answer alone, or "Replies closed on May 12".
 * It steps aside while the reply card itself is on screen, so the same
 * action never shows twice.
 */
export function ReplyDock({
  window: rsvpWindow,
  status,
  closesAt,
  away,
  onReply,
}: {
  window: RsvpWindow;
  status: RsvpStatus;
  closesAt: string | null | undefined;
  /** The reply card is on screen. */
  away: boolean;
  onReply: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const hub = t.guestHub;
  if (rsvpWindow === "hidden" || rsvpWindow === "scheduled") return null;
  const deadline = shortDate(closesAt, locale);
  const live = rsvpWindow === "live";

  const statusText =
    status === "attending"
      ? hub.coming
      : status === "maybe"
        ? live
          ? copy.dockMaybe(deadline)
          : hub.maybe
        : status === "declined"
          ? hub.notComing
          : deadline
            ? copy.dockClosedOn(deadline)
            : copy.dockClosed;
  const action =
    status === "maybe" ? copy.dockConfirm : status === "declined" ? copy.dockChangeMind : copy.dockEdit;

  return (
    <div className={`wp-dock${away ? " is-away" : ""}`} aria-hidden={away || undefined} inert={away || undefined}>
      {status === "pending" && live ? (
        <button type="button" className="gh-btn wp-dock-cta" onClick={onReply}>
          {deadline ? copy.dockReplyBy(deadline) : copy.dockReply}
        </button>
      ) : (
        <div className="wp-dock-status">
          <b>{statusText}</b>
          {live ? (
            <button type="button" className="gh-btn gh-btn--small" onClick={onReply}>
              {action}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
