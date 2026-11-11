"use client";

import React from "react";
import Link from "next/link";
import { DS } from "@/lib/theme";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export type ReplyStats = {
  invited: number;
  coming: number;
  maybe: number;
  declined: number;
  waiting: number;
  headcount: number;
  headcountMax: number;
};

/**
 * Where the replies stand, in one glance: how many have answered and one
 * bar split by answer. The whole card opens the guest list. While the
 * guests load it shows placeholders, never a made-up zero.
 */
export function RepliesSummary({
  stats,
  showMaybe,
  t,
}: {
  stats: ReplyStats | null;
  showMaybe: boolean;
  t: Dictionary;
}) {
  if (!stats) {
    return (
      <div className="ds-card" aria-busy="true" aria-label={t.guests.loadingList}>
        <span className="ds-skeleton" style={{ width: "55%", height: 36 }} />
        <span className="ds-skeleton" style={{ width: "100%", height: 8, marginTop: 18 }} />
        <span className="ds-skeleton" style={{ width: "70%", height: 14, marginTop: 14 }} />
      </div>
    );
  }

  const answered = stats.invited - stats.waiting;
  const parts = [
    { key: "coming", label: t.guests.filterComing, value: stats.coming, color: DS.coming },
    ...(showMaybe ? [{ key: "maybe", label: t.guests.filterMaybe, value: stats.maybe, color: DS.maybe }] : []),
    { key: "declined", label: t.guests.filterCant, value: stats.declined, color: DS.cant },
    { key: "waiting", label: t.guests.filterWaiting, value: stats.waiting, color: DS.track },
  ];

  return (
    <Link href="/guests/list" className="ds-card ds-summary" aria-label={t.guests.hub.summaryLink}>
      <p className="ds-summary-count">
        {stats.waiting === 0 ? (
          <span className="ds-lede">{t.guests.hub.allAnswered}</span>
        ) : (
          <>
            <b>{answered}</b>
            <span>{t.guests.hub.answeredOf(stats.invited)}</span>
          </>
        )}
      </p>
      <div
        className="ds-meter"
        role="img"
        aria-label={`${t.guests.hub.replyBar}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`}
        style={{ marginTop: 16 }}
      >
        {parts.map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.color }} />
        ))}
      </div>
      <ul className="ds-summary-legend" aria-hidden>
        {parts.map((p) => (
          <li key={p.key}>
            <span
              className="ds-dot"
              style={
                p.key === "waiting"
                  ? { boxShadow: `inset 0 0 0 2px ${DS.waiting}` }
                  : { background: p.color }
              }
            />
            {p.label} <b className="ds-num">{p.value}</b>
          </li>
        ))}
      </ul>
    </Link>
  );
}
