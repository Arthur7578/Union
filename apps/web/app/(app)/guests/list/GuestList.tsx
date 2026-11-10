"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  filterGuests,
  guestReplyStatus,
  parseGuestStatusFilter,
  type GuestStatusFilter,
} from "@union/shared";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { guestStats } from "@/lib/data";
import { initial } from "@/lib/format";
import { Card, Button, Loading, Chip } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { ChevronRight, SearchIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { useGuests } from "../useGuests";

const STATUS_DOT: Record<string, string> = {
  attending: T.green,
  maybe: T.blueInk,
  declined: T.roseSoft,
  pending: T.ringAmber,
};

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
    ["waiting", t.guests.filterWaiting, stats?.waiting],
    ["declined", t.guests.filterCant, stats?.declined],
  ];

  const filtered = useMemo(
    () => (guests ? filterGuests(guests, filter, query) : []),
    [guests, filter, query],
  );

  if (!wedding) return null;

  return (
    <main className="u-main">
      <BackHeader
        title={t.guests.hub.listTitle}
        subtitle={stats ? `${stats.invited} ${t.guests.kicker}` : undefined}
        fallback="/guests"
        right={
          <Link href="/guests/new" className="gu-add" style={{ minHeight: 40, fontSize: 14 }}>
            {t.guests.addShort}
          </Link>
        }
      />

      {guests !== null && guests.length > 0 && (
        <>
          <div
            role="group"
            aria-label={t.guests.hub.replyBar}
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}
          >
            {filterChips.map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className="gu-chip"
              >
                <Chip active={filter === key}>
                  {label}
                  {typeof n === "number" && n > 0 ? ` · ${n}` : ""}
                </Chip>
              </button>
            ))}
          </div>
          <div className="gu-find" style={{ marginTop: 0, marginBottom: 12 }}>
            <label htmlFor="gl-q" className="gu-sr">
              {t.guests.hub.find}
            </label>
            <SearchIcon />
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
        <Loading label={t.guests.loadingList} />
      ) : guests.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div className="u-serif" style={{ fontSize: 22, color: T.ink }}>
            {t.guests.noGuestsTitle}
          </div>
          <div style={{ fontSize: 14, color: T.muted, margin: "6px 0 16px" }}>
            {t.guests.noGuestsBody}
          </div>
          <Link href="/guests/new">
            <Button>{t.guests.add}</Button>
          </Link>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "22px 20px" }}>
          <div style={{ fontSize: 14, color: T.muted }}>{t.guests.noMatches}</div>
        </Card>
      ) : (
        <ul role="list" aria-label={t.guests.hub.listTitle} className="gu-group">
          {filtered.map((g) => {
            const status = guestReplyStatus(g);
            const meta = [g.guest_group, g.role].filter(Boolean).join(" · ");
            const statusLabel =
              status === "attending"
                ? t.guests.filterComing
                : status === "maybe"
                  ? t.guests.filterMaybe
                  : status === "declined"
                    ? t.guests.filterCant
                    : t.guests.filterWaiting;
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
                    {meta && (
                      <span style={{ display: "block", fontSize: 12.5, color: T.muted, marginTop: 1 }}>
                        {meta}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: T.muted,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: STATUS_DOT[status] ?? T.sand,
                      }}
                    />
                    {statusLabel}
                  </span>
                  <ChevronRight />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
