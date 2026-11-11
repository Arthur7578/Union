"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  filterGuests,
  guestReplyStatus,
  parseGuestStatusFilter,
  type GuestStatusFilter,
} from "@union/shared";
import { DS } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial } from "@/lib/format";
import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { useGuests } from "../useGuests";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Every guest, filterable by reply and searchable: the guest list module of
 * the Guests hub. The hub links here with `?status=` (a reply), `?email=missing`
 * (no email on file) and `?q=` (a search); filters stay in the URL so going
 * back to the list keeps them.
 */
export function GuestList() {
  const t = useT();
  const h = t.guests.hub;
  const { wedding } = useWedding();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { guests } = useGuests(wedding?.id);
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const filter = parseGuestStatusFilter(params.get("status"));
  const noEmailOnly = params.get("email") === "missing";
  const activeChip = useRef<HTMLButtonElement>(null);
  // Read once per visit, for "nudged N days ago".
  const [now] = useState(() => Date.now());

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value === null) sp.delete(key);
    else sp.set(key, value);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const stats = guests ? guestStats(guests) : null;
  const showMaybe = wedding?.allow_rsvp_maybe === true || (stats?.maybe ?? 0) > 0;

  // Same order as the hub's summary: All, Coming, Maybe, Can't, Waiting.
  const filterChips: Array<[GuestStatusFilter, string, number | undefined]> = [
    ["all", t.guests.filterAll, stats?.invited],
    ["coming", t.guests.filterComing, stats?.coming],
    ...(showMaybe
      ? ([["maybe", t.guests.filterMaybe, stats?.maybe]] as Array<
          [GuestStatusFilter, string, number | undefined]
        >)
      : []),
    ["declined", t.guests.filterCant, stats?.declined],
    ["waiting", t.guests.filterWaiting, stats?.waiting],
  ];

  const filtered = useMemo(() => {
    if (!guests) return [];
    const shown = filterGuests(guests, filter, query);
    return noEmailOnly ? shown.filter((g) => !g.email) : shown;
  }, [guests, filter, query, noEmailOnly]);

  // Arriving from the hub on a filter further along the row: bring its chip
  // into view, since the row scrolls sideways on a phone.
  const loaded = guests !== null;
  useEffect(() => {
    activeChip.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [filter, loaded]);

  if (!wedding) return null;

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/guests");
  };

  return (
    <main className="u-main ds ds-wide">
      <div className="ds-narrow">
        <header className="ds-header" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button type="button" onClick={back} aria-label={h.backToGuests} className="ds-back">
              <ChevronLeft stroke="currentColor" />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 className="ds-h1" style={{ fontSize: 26 }}>
                {h.listTitle}
              </h1>
              {stats && <div className="ds-row-sub ds-num">{h.listSub(stats.invited)}</div>}
            </div>
          </div>
          <Link href="/guests/new" className="ds-btn is-small">
            <PlusIcon />
            {t.guests.addShort}
          </Link>
        </header>

        {guests !== null && guests.length > 0 && (
          <>
            <div role="group" aria-label={h.replyBar} className="ds-chips">
              {filterChips.map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  ref={filter === key ? activeChip : undefined}
                  onClick={() => setParam("status", key === "all" ? null : key)}
                  className="ds-chip"
                >
                  {label}
                  {typeof n === "number" && n > 0 && <span className="ds-num">{n}</span>}
                </button>
              ))}
              {noEmailOnly && (
                <button
                  type="button"
                  aria-pressed
                  onClick={() => setParam("email", null)}
                  className="ds-chip"
                  aria-label={`${h.noEmailFilter}, ${h.clearFilter}`}
                >
                  {h.noEmailFilter} <span aria-hidden>×</span>
                </button>
              )}
            </div>
            <div className="ds-field" style={{ marginBottom: 14 }}>
              <label htmlFor="ds-list-q" className="ds-sr">
                {h.find}
              </label>
              <SearchIcon stroke={DS.muted} />
              <input
                id="ds-list-q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={h.findPlaceholder}
                autoComplete="off"
              />
            </div>
          </>
        )}

        {guests === null ? (
          <ul className="ds-group" aria-busy="true" aria-label={t.guests.loadingList}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="ds-row">
                <span className="ds-skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
                <span className="ds-skeleton" style={{ flex: 1, height: 14, maxWidth: 180 }} />
              </li>
            ))}
          </ul>
        ) : guests.length === 0 ? (
          <section className="ds-card" style={{ textAlign: "center", padding: "28px 20px" }}>
            <h2 className="ds-lede" style={{ margin: 0 }}>
              {t.guests.noGuestsTitle}
            </h2>
            <p className="ds-quiet" style={{ margin: "8px 0 18px" }}>
              {t.guests.noGuestsBody}
            </p>
            <Link href="/guests/new" className="ds-btn">
              {t.guests.add}
            </Link>
          </section>
        ) : filtered.length === 0 ? (
          <section className="ds-card" style={{ textAlign: "center" }}>
            <p className="ds-quiet">{t.guests.noMatches}</p>
          </section>
        ) : (
          <ul role="list" aria-label={h.listTitle} className="ds-group">
            {filtered.map((g) => {
              const status = guestReplyStatus(g) as "attending" | "maybe" | "declined" | "pending";
              const meta = [g.guest_group, g.role].filter(Boolean).join(" · ");
              const nudgedDays =
                status === "pending" && g.rsvp_reminder_sent_at
                  ? Math.max(0, Math.floor((now - new Date(g.rsvp_reminder_sent_at).getTime()) / DAY))
                  : null;
              return (
                <li key={g.id}>
                  <Link href={`/guests/${g.id}`} className="ds-row">
                    <span aria-hidden className={`ds-face is-${status}`}>
                      {initial(g.first_name)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ds-row-title">
                        {g.first_name} {g.last_name ?? ""}
                      </span>
                      {meta && <span className="ds-row-sub">{meta}</span>}
                      {status === "pending" && !g.email && (
                        <span className="ds-row-sub ds-status is-pending">{h.noEmail}</span>
                      )}
                      {nudgedDays !== null && <span className="ds-row-sub">{h.nudgedAgo(nudgedDays)}</span>}
                    </span>
                    {/* Under a filter every row would repeat the same answer. */}
                    {filter === "all" && (
                      <span className={`ds-row-sub ds-status is-${status}`} style={{ flexShrink: 0, marginTop: 0 }}>
                        {h.replied[status]}
                      </span>
                    )}
                    <span className="ds-chev">
                      <ChevronRight stroke="currentColor" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
