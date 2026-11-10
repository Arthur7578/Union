"use client";

import React from "react";
import Link from "next/link";
import Form from "next/form";
import { latestReplies, parseWeddingAccent } from "@union/shared";
import { V, accentVars } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { formatLongDate, initial, timeAgo } from "@/lib/format";
import { SearchIcon, ChevronRight, PlusIcon } from "@/components/icons";
import { useLocale } from "@/lib/i18n/client";
import { useGuests, useRsvpNudge } from "./useGuests";
import { RepliesPanel, NudgeRow } from "./RepliesPanel";
import { GuestTools, guestStages } from "./GuestTools";
import { guestsTypeClass } from "./guestsType";

/**
 * The Guests hub: where the replies stand and what to do about it, a way
 * straight to any guest, and every guest tool grouped by stage. The full
 * list lives at /guests/list. The frame is neutral; the couple's wedding
 * colour is the one colour it wears.
 */
export default function GuestsPage() {
  const { t, locale } = useLocale();
  const { wedding } = useWedding();
  const { guests, reload } = useGuests(wedding?.id);
  const nudge = useRsvpNudge(wedding, guests, reload, t);

  if (!wedding) return null;

  const accent = parseWeddingAccent(wedding.accent);
  const stats = guests ? guestStats(guests) : null;
  const showMaybe = wedding.allow_rsvp_maybe === true || (stats?.maybe ?? 0) > 0;
  const recent = guests ? latestReplies(guests, 4) : [];
  const empty = guests !== null && guests.length === 0;
  const couple = [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ");
  const when = wedding.event_date ? formatLongDate(wedding.event_date, locale) : null;

  return (
    <main
      className={`u-main gu-main ${guestsTypeClass}`}
      style={accentVars(accent) as React.CSSProperties}
    >
      <header className="gu-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="gu-h1">{t.guests.title}</h1>
          {/* Whose wedding this is, in their colour: the personality comes
              from the couple, not from Union. */}
          {(couple || when) && (
            <div className="gu-couple">
              <span aria-hidden className="gu-swatch-dot" />
              <span>{[couple, when].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {!accent && (
            <div className="gu-couple" style={{ marginTop: 4 }}>
              <Link href="/account/wedding#wedding-colour">{t.guests.hub.pickColour}</Link>
            </div>
          )}
        </div>
        <Link href="/guests/new" className="gu-add">
          <PlusIcon />
          {t.guests.addShort}
        </Link>
      </header>

      <div className="gu-layout">
        <div>
          {empty ? (
            <section className="gu-panel gu-empty" aria-labelledby="gu-empty-title">
              <h2 id="gu-empty-title" className="gu-lede" style={{ margin: 0 }}>
                {t.guests.hub.emptyTitle}
              </h2>
              <p className="gu-quiet" style={{ margin: "10px 0 20px", maxWidth: "46ch" }}>
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
                <SearchIcon stroke={V.muted} />
                <input
                  id="gu-q"
                  name="q"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t.guests.hub.findPlaceholder}
                />
              </Form>

              <section aria-labelledby="gu-latest">
                <div className="gu-section-head">
                  <h2 id="gu-latest" className="gu-h2">
                    {t.guests.hub.latest}
                  </h2>
                  {guests && guests.length > 0 && (
                    <Link href="/guests/list" className="gu-more">
                      {t.guests.hub.seeAll(guests.length)}
                    </Link>
                  )}
                </div>
                {guests === null ? (
                  <p className="gu-quiet" role="status">
                    {t.guests.loadingList}
                  </p>
                ) : recent.length === 0 ? (
                  <p className="gu-quiet">{t.guests.hub.noRepliesYet}</p>
                ) : (
                  <ul role="list" className="gu-group">
                    {recent.map((g) => {
                      const status = g.rsvps!.status as "attending" | "maybe" | "declined";
                      return (
                        <li key={g.id}>
                          <Link href={`/guests/${g.id}`} className="gu-row">
                            <span aria-hidden className={`gu-face is-${status}`}>
                              {initial(g.first_name)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span className="gu-row-title">
                                {g.first_name} {g.last_name ?? ""}
                              </span>
                              <span className="gu-row-sub">
                                <span className={`gu-reply is-${status}`}>{t.guests.hub.replied[status]}</span>
                                {" · "}
                                {timeAgo(g.rsvps!.responded_at, locale)}
                              </span>
                            </span>
                            <span className="gu-chev">
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
