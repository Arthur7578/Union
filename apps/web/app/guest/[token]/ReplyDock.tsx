"use client";

import { useLocale } from "@/lib/i18n/client";
import type { RsvpStatus } from "@/lib/submitRsvp";
import { shortDate } from "./pageFormat";
import type { RsvpWindow } from "./ReplySection";

/**
 * The reply, fixed at the bottom of the page: "Reply · by May 12" until the
 * guest answers, then their answer and "Change". It steps aside while the
 * reply card itself is on screen, so the same action never shows twice.
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
    status === "attending" ? hub.coming : status === "maybe" ? hub.maybe : status === "declined" ? hub.notComing : copy.dockClosed;

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
              {copy.dockEdit}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
