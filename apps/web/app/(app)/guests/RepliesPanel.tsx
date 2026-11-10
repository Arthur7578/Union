"use client";

import React from "react";
import Link from "next/link";
import { M } from "@/lib/theme";
import { EnvelopeIcon } from "@/components/icons";
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
 * and a way into the list for each answer. The nudge for the people still
 * waiting sits underneath, since it is the one thing to do about it.
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
    { key: "coming", label: t.guests.filterComing, value: stats?.coming ?? 0, color: M.coming },
    ...(showMaybe
      ? [{ key: "maybe" as const, label: t.guests.filterMaybe, value: stats?.maybe ?? 0, color: M.maybe }]
      : []),
    { key: "declined", label: t.guests.filterCant, value: stats?.declined ?? 0, color: M.cant },
    { key: "waiting", label: t.guests.filterWaiting, value: stats?.waiting ?? 0, color: M.sageSoft },
  ];
  const total = stats?.invited ?? 0;

  return (
    <section aria-labelledby="mq-replies" className="mq-panel">
      <h2 id="mq-replies" style={{ margin: 0 }}>
        {stats && stats.invited > 0 && stats.waiting === 0 ? (
          <span className="mq-display mq-lede">{t.guests.hub.allAnswered}</span>
        ) : stats && answered === 0 ? (
          <span className="mq-display mq-lede">{t.guests.hub.noneAnswered}</span>
        ) : (
          <span className="mq-count">
            <span className="mq-display mq-numeral mq-num">{answered ?? "—"}</span>
            <span className="mq-count-of">{t.guests.hub.answeredOf(total)}</span>
          </span>
        )}
      </h2>

      {/* One bar, split by answer. Waiting stays the pale track: the part
          still to come. */}
      <div
        role="img"
        aria-label={`${t.guests.hub.replyBar}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
        className="mq-bar"
      >
        {segments.map((s) => (
          <span
            key={s.key}
            className="mq-seg"
            style={{
              flexGrow: total > 0 ? s.value : s.key === "waiting" ? 1 : 0,
              background: s.color,
            }}
          />
        ))}
      </div>

      <ul className="mq-legend" role="list">
        {segments.map((s) => (
          <li key={s.key}>
            <Link href={`/guests/list?status=${s.key}`}>
              <span
                aria-hidden
                className="mq-dot"
                style={
                  s.key === "waiting"
                    ? { boxShadow: `inset 0 0 0 2px ${M.waiting}` }
                    : { background: s.color }
                }
              />
              {s.label}
              <b className="mq-num">{stats ? s.value : "—"}</b>
            </Link>
          </li>
        ))}
      </ul>

      {stats && stats.maybe > 0 && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: M.muted, margin: "10px 0 0", lineHeight: 1.45 }}>
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
    <div className="mq-note">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flexShrink: 0, display: "flex" }}>
          <EnvelopeIcon stroke={M.butterInk} />
        </span>
        {/* Lead with the same number as Waiting above, then say who the
            nudge can reach: only guests with an email go in the Bcc. */}
        <p style={{ flex: "1 1 180px" }}>
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
          <button type="button" onClick={onSend} disabled={busy} className="mq-btn is-small">
            {busy
              ? t.guests.opening
              : withEmail === waiting
                ? t.guests.sendNudge
                : t.guests.hub.nudgeButton(withEmail)}
          </button>
        )}
      </div>
      {note && (
        <p role="status" style={{ fontSize: 13, margin: "8px 0 0 32px" }}>
          {note}
        </p>
      )}
    </div>
  );
}
