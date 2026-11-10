"use client";

import React from "react";
import Link from "next/link";
import Form from "next/form";
import { latestReplies } from "@union/shared";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial, timeAgo } from "@/lib/format";
import { Loading } from "@/components/ui";
import { SearchIcon, ChevronRight } from "@/components/icons";
import { useLocale } from "@/lib/i18n/client";
import { useGuests, useRsvpNudge } from "./useGuests";
import { RepliesPanel, NudgeRow } from "./RepliesPanel";
import { GuestTools, guestStages } from "./GuestTools";

const REPLY_COLOR: Record<string, string> = {
  attending: T.greenDeep,
  maybe: T.blueInk,
  declined: T.muted,
};

/**
 * The Guests hub: where the replies stand and what to do about it, a way
 * straight to any guest, and every guest tool grouped by stage. The full
 * list lives at /guests/list.
 */
export default function GuestsPage() {
  const { t, locale } = useLocale();
  const { wedding } = useWedding();
  const { guests, reload } = useGuests(wedding?.id);
  const nudge = useRsvpNudge(wedding, guests, reload, t);

  if (!wedding) return null;

  const stats = guests ? guestStats(guests) : null;
  const showMaybe = wedding.allow_rsvp_maybe === true || (stats?.maybe ?? 0) > 0;
  const recent = guests ? latestReplies(guests, 4) : [];
  const empty = guests !== null && guests.length === 0;

  return (
    <main className="u-main gu-main">
      <header className="gu-header">
        <h1 className="u-serif gu-h1">{t.guests.title}</h1>
        <Link href="/guests/new" className="gu-add">
          {t.guests.add}
        </Link>
      </header>

      <div className="gu-layout">
        <div className="gu-col">
          {empty ? (
            <section
              className="gu-empty"
              aria-labelledby="gu-empty-title"
              style={{ background: T.surface, border: `1px solid ${T.line2}` }}
            >
              <h2 id="gu-empty-title" className="u-serif gu-lede" style={{ margin: 0 }}>
                {t.guests.hub.emptyTitle}
              </h2>
              <p style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.5, margin: "8px 0 18px", maxWidth: "46ch" }}>
                {t.guests.hub.emptyBody}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/guests/new" className="gu-add">
                  {t.guests.add}
                </Link>
                <Link href="/guests/group-link" className="gu-ghost">
                  {t.guests.hub.shareLink}
                </Link>
              </div>
            </section>
          ) : (
            <>
              <RepliesPanel
                stats={stats}
                showMaybe={showMaybe}
                t={t}
                nudge={
                  stats && stats.waiting > 0 ? (
                    <NudgeRow
                      waiting={stats.waiting}
                      withEmail={nudge.waitingWithEmail.length}
                      busy={nudge.busy}
                      note={nudge.note}
                      onSend={nudge.send}
                      t={t}
                    />
                  ) : null
                }
              />

              <Form action="/guests/list" className="gu-find" role="search">
                <label htmlFor="gu-q" className="gu-sr">
                  {t.guests.hub.find}
                </label>
                <SearchIcon />
                <input
                  id="gu-q"
                  name="q"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t.guests.hub.findPlaceholder}
                />
              </Form>

              <section aria-labelledby="gu-latest" style={{ marginTop: 26 }}>
                <div className="gu-section-head">
                  <h2 id="gu-latest" className="u-serif gu-h2" style={{ margin: 0 }}>
                    {t.guests.hub.latest}
                  </h2>
                  {guests && guests.length > 0 && (
                    <Link href="/guests/list" className="gu-more">
                      {t.guests.hub.seeAll(guests.length)}
                    </Link>
                  )}
                </div>
                {guests === null ? (
                  <Loading label={t.guests.loadingList} />
                ) : recent.length === 0 ? (
                  <p style={{ fontSize: 14, color: T.muted, margin: "4px 2px 0", lineHeight: 1.5 }}>
                    {t.guests.hub.noRepliesYet}
                  </p>
                ) : (
                  <ul role="list" className="gu-group">
                    {recent.map((g) => {
                      const status = g.rsvps!.status as "attending" | "maybe" | "declined";
                      return (
                        <li key={g.id}>
                          <Link href={`/guests/${g.id}`} className="gu-row">
                            <span
                              aria-hidden
                              className="u-serif"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: T.accentPink,
                                color: T.accentInk,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontWeight: 600,
                                fontSize: 16,
                              }}
                            >
                              {initial(g.first_name)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span className="gu-name">
                                {g.first_name} {g.last_name ?? ""}
                              </span>
                              <span style={{ display: "block", fontSize: 12.5, marginTop: 1 }}>
                                <span style={{ color: REPLY_COLOR[status], fontWeight: 600 }}>
                                  {t.guests.hub.replied[status]}
                                </span>
                                <span style={{ color: T.muted }}>
                                  {" · "}
                                  {timeAgo(g.rsvps!.responded_at, locale)}
                                </span>
                              </span>
                            </span>
                            <ChevronRight />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <div className="gu-col">
          <GuestTools stages={guestStages(t, guests ? guests.length : null)} />
        </div>
      </div>
    </main>
  );
}
