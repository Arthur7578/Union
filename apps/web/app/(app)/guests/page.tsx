"use client";

import React from "react";
import Link from "next/link";
import Form from "next/form";
import { latestReplies } from "@union/shared";
import { M } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial, timeAgo } from "@/lib/format";
import { SearchIcon, ChevronRight } from "@/components/icons";
import { useLocale } from "@/lib/i18n/client";
import { useGuests, useRsvpNudge } from "./useGuests";
import { RepliesPanel, NudgeRow } from "./RepliesPanel";
import { GuestTools, guestStages } from "./GuestTools";
import { marqueeClass } from "./marquee";
import { MarqueeTop } from "./MarqueeTop";

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
    <main className={`u-main mq-main ${marqueeClass}`}>
      <MarqueeTop>
        <header className="mq-header">
          <h1 className="mq-display mq-h1">{t.guests.title}</h1>
          <Link href="/guests/new" className="mq-btn">
            {t.guests.add}
          </Link>
        </header>
      </MarqueeTop>

      <div className="mq-layout">
        <div>
          {empty ? (
            <section className="mq-panel" aria-labelledby="mq-empty-title" style={{ padding: "26px 22px 24px" }}>
              <h2 id="mq-empty-title" className="mq-display mq-lede" style={{ margin: 0 }}>
                {t.guests.hub.emptyTitle}
              </h2>
              <p className="mq-quiet" style={{ margin: "10px 0 20px", maxWidth: "46ch" }}>
                {t.guests.hub.emptyBody}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/guests/new" className="mq-btn">
                  {t.guests.add}
                </Link>
                <Link href="/guests/group-link" className="mq-ghost">
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

              <Form action="/guests/list" className="mq-find" role="search">
                <label htmlFor="mq-q" className="mq-sr">
                  {t.guests.hub.find}
                </label>
                <SearchIcon stroke={M.muted} />
                <input
                  id="mq-q"
                  name="q"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t.guests.hub.findPlaceholder}
                />
              </Form>

              <section aria-labelledby="mq-latest">
                <div className="mq-section-head">
                  <h2 id="mq-latest" className="mq-display mq-h2">
                    {t.guests.hub.latest}
                  </h2>
                  {guests && guests.length > 0 && (
                    <Link href="/guests/list" className="mq-more">
                      {t.guests.hub.seeAll(guests.length)}
                    </Link>
                  )}
                </div>
                {guests === null ? (
                  <p className="mq-quiet" role="status">
                    {t.guests.loadingList}
                  </p>
                ) : recent.length === 0 ? (
                  <p className="mq-quiet">{t.guests.hub.noRepliesYet}</p>
                ) : (
                  <ul role="list" className="mq-group">
                    {recent.map((g) => {
                      const status = g.rsvps!.status as "attending" | "maybe" | "declined";
                      return (
                        <li key={g.id}>
                          <Link href={`/guests/${g.id}`} className="mq-row">
                            <span aria-hidden className={`mq-face is-${status}`}>
                              {initial(g.first_name)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span className="mq-row-title">
                                {g.first_name} {g.last_name ?? ""}
                              </span>
                              <span className="mq-row-sub">
                                <span className={`mq-reply is-${status}`} style={{ fontWeight: 800 }}>
                                  {t.guests.hub.replied[status]}
                                </span>
                                {" · "}
                                {timeAgo(g.rsvps!.responded_at, locale)}
                              </span>
                            </span>
                            <span className="mq-chev">
                              <ChevronRight stroke="currentColor" />
                            </span>
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

        <div>
          <GuestTools stages={guestStages(t, guests ? guests.length : null)} />
        </div>
      </div>
    </main>
  );
}
