"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { guestAttention } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import { fetchDuplicateGroups, fetchSeatingTables, guestStats } from "@/lib/data";
import { PlusIcon } from "@/components/icons";
import { useLocale } from "@/lib/i18n/client";
import { useGuests, useRsvpNudge } from "./useGuests";
import { RepliesSummary } from "./RepliesSummary";
import { AttentionList } from "./Attention";
import { GuestTools, guestStages } from "./GuestTools";

/**
 * The root of the Guests hub. Its job: tell the couple whether anything
 * needs them on their guests, and let them act in one tap. Then the way
 * into every module, the guest list included (/guests/list). Nothing to
 * browse here: no search, no list.
 */
export default function GuestsPage() {
  const { t } = useLocale();
  const { wedding } = useWedding();
  const { guests, reload } = useGuests(wedding?.id);
  const nudge = useRsvpNudge(wedding, guests, reload, t);
  const [context, setContext] = useState<{ duplicateGroups: number; seatingTables: number } | null>(
    null,
  );

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    // A side check each: if one fails, the hub still shows the rest.
    Promise.all([
      fetchDuplicateGroups(wedding.id).then((g) => g.length, () => 0),
      fetchSeatingTables(wedding.id).then((s) => s.length, () => 0),
    ]).then(([duplicateGroups, seatingTables]) => ok && setContext({ duplicateGroups, seatingTables }));
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;

  const stats = guests ? guestStats(guests) : null;
  const showMaybe = wedding.allow_rsvp_maybe === true || (stats?.maybe ?? 0) > 0;
  const loaded = guests !== null && context !== null;
  const items = loaded ? guestAttention(guests, context) : [];
  const unseated = items.find((i) => i.kind === "unseated");
  const empty = guests !== null && guests.length === 0;

  return (
    <main className="u-main ds ds-wide">
      <header className="ds-header" style={{ alignItems: "center" }}>
        <h1 className="ds-h1">{t.guests.title}</h1>
        {!empty && (
          <Link href="/guests/new" className="ds-btn is-ghost">
            <PlusIcon stroke="currentColor" />
            {t.guests.addShort}
          </Link>
        )}
      </header>

      <div className="ds-split">
        <div>
          {empty ? (
            <section className="ds-card" aria-labelledby="ds-empty-title" style={{ padding: "26px 22px 24px" }}>
              <h2 id="ds-empty-title" className="ds-lede" style={{ margin: 0 }}>
                {t.guests.hub.emptyTitle}
              </h2>
              <p className="ds-quiet" style={{ margin: "10px 0 20px", maxWidth: "46ch" }}>
                {t.guests.hub.emptyBody}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/guests/new" className="ds-btn">
                  {t.guests.add}
                </Link>
                <Link href="/guests/group-link" className="ds-btn is-ghost">
                  {t.guests.hub.shareLink}
                </Link>
              </div>
            </section>
          ) : (
            <>
              <RepliesSummary stats={stats} showMaybe={showMaybe} t={t} />
              <section aria-labelledby="ds-todo">
                <h2 id="ds-todo" className="ds-h2">
                  {t.guests.hub.todo}
                </h2>
                {loaded ? (
                  <AttentionList
                    items={items}
                    nudge={nudge}
                    headcount={{ firm: stats!.headcount, ceiling: stats!.headcountMax }}
                    t={t}
                  />
                ) : (
                  <div className="ds-task" aria-busy="true">
                    <span className="ds-skeleton" style={{ width: 36, height: 36, borderRadius: 11 }} />
                    <div style={{ flex: 1 }}>
                      <span className="ds-skeleton" style={{ width: "70%", height: 16 }} />
                      <span className="ds-skeleton" style={{ width: "90%", height: 13, marginTop: 10 }} />
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <section aria-labelledby="ds-modules">
          <h2 id="ds-modules" className="ds-h2">
            {t.guests.hub.modules}
          </h2>
          <GuestTools
            stages={guestStages(t, {
              guests: guests ? guests.length : null,
              duplicates: context?.duplicateGroups ?? 0,
              unseated: unseated && unseated.kind === "unseated" ? unseated.count : 0,
            })}
          />
        </section>
      </div>
    </main>
  );
}
