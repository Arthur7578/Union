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
import { V } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial } from "@/lib/format";
import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { useGuests } from "../useGuests";
import { guestsTypeClass } from "../guestsType";

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
  // into view when the row wraps or scrolls on a phone.
  const loaded = guests !== null;
  useEffect(() => {
    activeChip.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [filter, loaded]);

  if (!wedding) return null;

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/guests");
  };

  const statusLabel = (status: string) =>
    status === "attending"
      ? t.guests.filterComing
      : status === "maybe"
        ? t.guests.filterMaybe
        : status === "declined"
          ? t.guests.filterCant
          : t.guests.filterWaiting;

  return (
    <main className={`u-main gu-main gu-list ${guestsTypeClass}`}>
      <header className="gu-header" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button type="button" onClick={back} aria-label={t.guests.title} className="gu-back">
            <ChevronLeft stroke="currentColor" />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 className="gu-h1" style={{ fontSize: 26, textWrap: "balance" }}>
              {t.guests.hub.listTitle}
            </h1>
            {stats && (
              <div className="gu-row-sub gu-num">
                {stats.invited} {t.guests.kicker}
              </div>
            )}
          </div>
        </div>
        <Link href="/guests/new" className="gu-add is-small">
          <PlusIcon />
          {t.guests.addShort}
        </Link>
      </header>

      <div className="gu-list-body">
        {guests !== null && guests.length > 0 && (
          <>
            <div role="group" aria-label={t.guests.hub.replyBar} className="gu-chips">
              {filterChips.map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  ref={filter === key ? activeChip : undefined}
                  onClick={() => setFilter(key)}
                  className="gu-chip"
                >
                  {label}
                  {typeof n === "number" && n > 0 && <span className="gu-num">{n}</span>}
                </button>
              ))}
            </div>
            <div className="gu-find" style={{ marginTop: 0, marginBottom: 14 }}>
              <label htmlFor="gl-q" className="gu-sr">
                {t.guests.hub.find}
              </label>
              <SearchIcon stroke={V.muted} />
              <input
                id="gl-q"
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
          <p className="gu-quiet" role="status">
            {t.guests.loadingList}
          </p>
        ) : guests.length === 0 ? (
          <section className="gu-panel gu-empty" style={{ textAlign: "center" }}>
            <h2 className="gu-lede" style={{ margin: 0 }}>
              {t.guests.noGuestsTitle}
            </h2>
            <p className="gu-quiet" style={{ margin: "8px 0 18px" }}>
              {t.guests.noGuestsBody}
            </p>
            <Link href="/guests/new" className="gu-add">
              {t.guests.add}
            </Link>
          </section>
        ) : filtered.length === 0 ? (
          <section className="gu-panel" style={{ textAlign: "center", padding: "22px 20px" }}>
            <p className="gu-quiet" style={{ margin: 0 }}>
              {t.guests.noMatches}
            </p>
          </section>
        ) : (
          <ul role="list" aria-label={t.guests.hub.listTitle} className="gu-group">
            {filtered.map((g) => {
              const status = guestReplyStatus(g);
              const meta = [g.guest_group, g.role].filter(Boolean).join(" · ");
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
                      {meta && <span className="gu-row-sub">{meta}</span>}
                      {status === "pending" && !g.email && (
                        <span className="gu-row-sub gu-alert">{t.guests.hub.noEmail}</span>
                      )}
                    </span>
                    {/* Under a filter every row would repeat the same answer. */}
                    {filter === "all" && (
                      <span className={`gu-row-sub gu-reply is-${status}`} style={{ flexShrink: 0 }}>
                        {statusLabel(status)}
                      </span>
                    )}
                    <span className="gu-chev">
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
