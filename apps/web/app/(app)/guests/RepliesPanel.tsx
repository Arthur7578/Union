"use client";

import React from "react";
import Link from "next/link";
import { T, alpha } from "@/lib/theme";
import { Button } from "@/components/ui";
import { Spark } from "@/components/icons";
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
    { key: "coming", label: t.guests.filterComing, value: stats?.coming ?? 0, color: T.green },
    ...(showMaybe
      ? [{ key: "maybe" as const, label: t.guests.filterMaybe, value: stats?.maybe ?? 0, color: T.blueInk }]
      : []),
    { key: "declined", label: t.guests.filterCant, value: stats?.declined ?? 0, color: T.roseSoft },
    { key: "waiting", label: t.guests.filterWaiting, value: stats?.waiting ?? 0, color: "transparent" },
  ];
  const total = stats?.invited ?? 0;

  return (
    <section
      aria-labelledby="gu-replies"
      style={{
        background: T.surface,
        border: `1px solid ${T.line2}`,
        borderRadius: 24,
        padding: "22px 20px 18px",
        boxShadow: `0 10px 30px ${alpha(T.ink, 0.06)}`,
      }}
    >
      <h2 id="gu-replies" style={{ margin: 0 }}>
        {stats && stats.invited > 0 && stats.waiting === 0 ? (
          <span className="u-serif gu-lede">{t.guests.hub.allAnswered}</span>
        ) : stats && answered === 0 ? (
          <span className="u-serif gu-lede">{t.guests.hub.noneAnswered}</span>
        ) : (
          <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span className="u-serif gu-numeral">{answered ?? "—"}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: T.muted }}>
              {t.guests.hub.answeredOf(total)}
            </span>
          </span>
        )}
      </h2>

      {/* One bar, split by answer. Waiting is left unfilled: it is the part
          still to come. */}
      <div
        role="img"
        aria-label={`${t.guests.hub.replyBar}: ${segments
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
        className="gu-bar"
        style={{ background: alpha(T.ink, 0.07), marginTop: 18 }}
      >
        {segments
          .filter((s) => s.key !== "waiting")
          .map((s) => (
            <span
              key={s.key}
              className="gu-seg"
              style={{
                flexGrow: total > 0 ? s.value : 0,
                background: s.color,
              }}
            />
          ))}
        <span className="gu-seg" style={{ flexGrow: total > 0 ? stats!.waiting : 1 }} />
      </div>

      <ul className="gu-legend" role="list">
        {segments.map((s) => (
          <li key={s.key}>
            <Link href={`/guests/list?status=${s.key}`} className="gu-legend-link">
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: s.key === "waiting" ? "transparent" : s.color,
                  border: s.key === "waiting" ? `2px solid ${T.ringAmber}` : "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ flex: 1, color: T.ink2 }}>{s.label}</span>
              <span className="gu-num" style={{ fontWeight: 600, color: T.ink }}>
                {stats ? s.value : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {stats && stats.maybe > 0 && (
        <p style={{ fontSize: 13, color: T.muted, margin: "12px 2px 0", lineHeight: 1.45 }}>
          {t.guests.headcountRange(stats.headcount, stats.headcountMax)}
        </p>
      )}

      {nudge}
    </section>
  );
}

/** The reminder line under the replies, for guests who haven't answered. */
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
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line2}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flexShrink: 0, display: "flex" }}>
          <Spark size={16} color={T.accent} />
        </span>
        <p style={{ flex: "1 1 180px", margin: 0, fontSize: 13.5, lineHeight: 1.45, color: T.ink2 }}>
          {withEmail > 0 ? (
            <>
              {t.guests.reminderPromptLead}{" "}
              <b style={{ color: T.ink }}>{t.guests.reminderPromptStrong(withEmail)}</b>
              {t.guests.reminderPromptTail}
            </>
          ) : (
            <>
              {t.guests.reminderNoEmail.before}
              <b style={{ color: T.ink }}>{t.guests.reminderNoEmail.strong(waiting)}</b>
              {t.guests.reminderNoEmail.after}
            </>
          )}
        </p>
        {withEmail > 0 && (
          <Button
            onClick={onSend}
            disabled={busy}
            style={{ minHeight: 40, fontSize: 13.5, padding: "0 16px", background: T.accentInk }}
          >
            {busy ? t.guests.opening : t.guests.sendNudge}
          </Button>
        )}
      </div>
      {note && (
        <p role="status" style={{ fontSize: 12.5, color: T.muted, margin: "8px 0 0 28px" }}>
          {note}
        </p>
      )}
    </div>
  );
}
