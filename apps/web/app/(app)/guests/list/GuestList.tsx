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
import { M } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial } from "@/lib/format";
import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { useGuests } from "../useGuests";
import { marqueeClass } from "../marquee";
import { MarqueeTop } from "../MarqueeTop";

/**
 * Every guest, filterable by reply and searchable. The hub links here with
 * `?status=` (a reply) and `?q=` (a search), and the filter stays in the URL
 * so going back to the list keeps it.
 */
export function GuestList() {
  const t = useT();
  const { wedding } = useWedding();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { guests } = useGuests(wedding?.id);
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const filter = parseGuestStatusFilter(params.get("status"));
  const activeChip = useRef<HTMLButtonElement>(null);

  const setFilter = (next: GuestStatusFilter) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "all") sp.delete("status");
    else sp.set("status", next);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/guests");
  };

  const stats = guests ? guestStats(guests) : null;
  const showMaybe = wedding?.allow_rsvp_maybe === true || (stats?.maybe ?? 0) > 0;

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

  const filtered = useMemo(
    () => (guests ? filterGuests(guests, filter, query) : []),
    [guests, filter, query],
  );

  // Arriving from the hub on a filter further along the row: bring its chip
  // into view, since the row scrolls sideways on a phone.
  const loaded = guests !== null;
  useEffect(() => {
    activeChip.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [filter, loaded]);

  if (!wedding) return null;

  const statusLabel = (status: string) =>
    status === "attending"
      ? t.guests.filterComing
      : status === "maybe"
        ? t.guests.filterMaybe
        : status === "declined"
          ? t.guests.filterCant
          : t.guests.filterWaiting;

  return (
    <main className={`u-main mq-main ${marqueeClass}`}>
      <MarqueeTop slim>
        <header className="mq-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button type="button" onClick={back} aria-label={t.guests.title} className="mq-back">
              <ChevronLeft stroke="currentColor" />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 className="mq-display" style={{ fontSize: 26, lineHeight: 1.05, margin: 0, textWrap: "balance" }}>
                {t.guests.hub.listTitle}
              </h1>
              {stats && (
                <div className="mq-row-sub mq-num">
                  {stats.invited} {t.guests.kicker}
                </div>
              )}
            </div>
          </div>
          <Link href="/guests/new" className="mq-btn is-small">
            <PlusIcon />
            {t.guests.addShort}
          </Link>
        </header>
      </MarqueeTop>

      <div className="mq-list-body">
        {guests !== null && guests.length > 0 && (
          <>
            <div role="group" aria-label={t.guests.hub.replyBar} className="mq-chips">
              {filterChips.map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  ref={filter === key ? activeChip : undefined}
                  onClick={() => setFilter(key)}
                  className="mq-chip"
                >
                  {label}
                  {typeof n === "number" && n > 0 && <span className="mq-num">{n}</span>}
                </button>
              ))}
            </div>
            <div className="mq-find" style={{ marginTop: 0, marginBottom: 16 }}>
              <label htmlFor="mq-list-q" className="mq-sr">
                {t.guests.hub.find}
              </label>
              <SearchIcon stroke={M.muted} />
              <input
                id="mq-list-q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.guests.searchPlaceholder}
                autoComplete="off"
              />
            </div>
          </>
        )}

        {guests === null ? (
          <p className="mq-quiet" role="status">
            {t.guests.loadingList}
          </p>
        ) : guests.length === 0 ? (
          <section className="mq-panel" style={{ textAlign: "center", padding: "28px 20px" }}>
            <h2 className="mq-display mq-lede" style={{ margin: 0 }}>
              {t.guests.noGuestsTitle}
            </h2>
            <p className="mq-quiet" style={{ margin: "8px 0 18px" }}>
              {t.guests.noGuestsBody}
            </p>
            <Link href="/guests/new" className="mq-btn">
              {t.guests.add}
            </Link>
          </section>
        ) : filtered.length === 0 ? (
          <section className="mq-panel" style={{ textAlign: "center", padding: "22px 20px" }}>
            <p className="mq-quiet" style={{ margin: 0 }}>
              {t.guests.noMatches}
            </p>
          </section>
        ) : (
          <ul role="list" aria-label={t.guests.hub.listTitle} className="mq-group">
            {filtered.map((g) => {
              const status = guestReplyStatus(g);
              const meta = [g.guest_group, g.role].filter(Boolean).join(" · ");
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
                      {meta && <span className="mq-row-sub">{meta}</span>}
                      {status === "pending" && !g.email && (
                        <span className="mq-row-sub mq-reply is-declined">{t.guests.hub.noEmail}</span>
                      )}
                    </span>
                    {/* Under a filter every row would repeat the same answer. */}
                    {filter === "all" && (
                      <span className={`mq-tag is-${status}`}>{statusLabel(status)}</span>
                    )}
                    <span className="mq-chev">
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
