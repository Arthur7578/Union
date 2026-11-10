"use client";

import React from "react";
import Link from "next/link";
import { V } from "@/lib/theme";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { GuestStatusFilter } from "@union/shared";

export type ReplyStats = {
  invited: number;
  coming: number;
  maybe: number;
  declined: number;
  waiting: number;
  headcount: number;
  headcountMax: number;
};

type Segment = {
  key: Exclude<GuestStatusFilter, "all">;
  label: string;
  value: number;
  color: string;
};

/**
 * Where the replies stand: how many have answered, one bar split by answer,
 * and a way into the list for each answer. The nudge for the guests still
 * waiting sits underneath.
 */
export function RepliesPanel({
  stats,
  showMaybe,
  t,
  nudge,
}: {
  stats: ReplyStats | null;
  showMaybe: boolean;
  t: Dictionary;
  nudge: React.ReactNode;
}) {
  const answered = stats ? stats.invited - stats.waiting : null;
  const segments: Segment[] = [
    { key: "coming", label: t.guests.filterComing, value: stats?.coming ?? 0, color: V.accent },
    ...(showMaybe
      ? [{ key: "maybe" as const, label: t.guests.filterMaybe, value: stats?.maybe ?? 0, color: V.accent2 }]
      : []),
    { key: "declined", label: t.guests.filterCant, value: stats?.declined ?? 0, color: V.cant },
    { key: "waiting", label: t.guests.filterWaiting, value: stats?.waiting ?? 0, color: V.track },
  ];
  const total = stats?.invited ?? 0;

  return (
    <section aria-labelledby="gu-replies" className="gu-panel">
      <h2 id="gu-replies" style={{ margin: 0 }}>
        {stats && stats.invited > 0 && stats.waiting === 0 ? (
          <span className="gu-lede">{t.guests.hub.allAnswered}</span>
        ) : stats && answered === 0 ? (
          <span className="gu-lede">{t.guests.hub.noneAnswered}</span>
        ) : (
          <span style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className="gu-numeral">{answered ?? "—"}</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: V.ink2 }}>
              {t.guests.hub.answeredOf(total)}
            </span>
          </span>
        )}
      </h2>

      {/* One bar, split by answer. Waiting stays the bare track: the part
          still to come. */}
      <div
        role="img"
        aria-label={`${t.guests.hub.replyBar}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
        className="gu-bar"
      >
        {segments.map((s) => (
          <span
            key={s.key}
            className="gu-seg"
            style={{
              flexGrow: total > 0 ? s.value : s.key === "waiting" ? 1 : 0,
              background: s.color,
            }}
          />
        ))}
      </div>

      <ul className="gu-legend" role="list">
        {segments.map((s) => (
          <li key={s.key}>
            <Link href={`/guests/list?status=${s.key}`} className="gu-legend-link">
              <span
                aria-hidden
                className="gu-dot"
                style={
                  s.key === "waiting"
                    ? { boxShadow: `inset 0 0 0 1.5px ${V.ring}` }
                    : { background: s.color }
                }
              />
              {s.label}
              <b className="gu-num">{stats ? s.value : "—"}</b>
            </Link>
          </li>
        ))}
      </ul>

      {stats && stats.maybe > 0 && (
        <p style={{ fontSize: 13.5, color: V.muted, margin: "10px 0 0", lineHeight: 1.45 }}>
          {t.guests.headcountRange(stats.headcount, stats.headcountMax)}
        </p>
      )}

      {nudge}
    </section>
  );
}

/** The reminder under the replies, for guests who haven't answered. */
export function NudgeRow({
  waiting,
  withEmail,
  busy,
  note,
  onSend,
  t,
}: {
  waiting: number;
  withEmail: number;
  busy: boolean;
  note: string | null;
  onSend: () => void;
  t: Dictionary;
}) {
  return (
    <div className="gu-nudge">
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {/* Lead with the same number as Waiting above, then say who the
            nudge can reach: only guests with an email go in the Bcc. */}
        <p style={{ flex: "1 1 200px" }}>
          {withEmail > 0 ? (
            <>
              <b>{t.guests.hub.nudgeWaiting(waiting)}</b>{" "}
              {withEmail === waiting
                ? t.guests.hub.nudgeAllReachable(waiting)
                : t.guests.hub.nudgeSomeReachable(withEmail, waiting - withEmail)}
            </>
          ) : (
            <>
              {t.guests.reminderNoEmail.before}
              <b>{t.guests.reminderNoEmail.strong(waiting)}</b>
              {t.guests.reminderNoEmail.after}
            </>
          )}
        </p>
        {withEmail > 0 && (
          <button type="button" onClick={onSend} disabled={busy} className="gu-add is-small">
            {busy
              ? t.guests.opening
              : withEmail === waiting
                ? t.guests.sendNudge
                : t.guests.hub.nudgeButton(withEmail)}
          </button>
        )}
      </div>
      {note && (
        <p role="status" style={{ fontSize: 13, marginTop: 8, color: V.muted }}>
          {note}
        </p>
      )}
    </div>
  );
}
