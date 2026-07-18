"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, SectionLabel, Button, Avatar, StatusPill } from "@/components/ui";
import { Spark } from "@/components/icons";
import { SAMPLE_TEAM, SAMPLE_ACTIVITY } from "@/lib/sample";

const ROLE_TONE: Record<string, "accent" | "green" | "amber"> = {
  Owner: "accent",
  Partner: "green",
  Pending: "amber",
};

export default function TeamPage() {
  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Plan together" subtitle="Your team · 2" fallback="/plan" />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SAMPLE_TEAM.map((m) => (
          <Card key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
            <Avatar letter={m.monogram} tint={m.tone as "accent" | "green" | "amber"} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                {m.name} {m.you && <span style={{ fontWeight: 400, color: T.faint }}>· you</span>}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{m.sub}</div>
            </div>
            <StatusPill tone={ROLE_TONE[m.role]}>{m.role}</StatusPill>
          </Card>
        ))}
      </div>

      {/* Invite */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 20,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: "16px 16px 15px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div className="u-serif" style={{ fontWeight: 600, fontSize: 19, color: T.ink }}>
          Invite someone to help
        </div>
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 4, lineHeight: 1.45 }}>
          They&apos;ll see everything and can act with you.
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
          <input type="email" placeholder="Email address…" style={{ flex: 1, minHeight: 44 }} />
          <Button style={{ flexShrink: 0 }}>Invite</Button>
        </div>
      </div>

      {/* Activity */}
      <SectionLabel>Who did what</SectionLabel>
      <div style={{ position: "relative", paddingLeft: 26 }}>
        <div style={{ position: "absolute", left: 8, top: 6, bottom: 12, width: 2, background: "rgba(67,53,58,.08)" }} />
        {SAMPLE_ACTIVITY.map((a, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 17 }}>
            <span
              style={{
                position: "absolute",
                left: a.kind === "union" ? -25 : -24,
                top: a.kind === "union" ? 0 : 1,
                width: a.kind === "union" ? 19 : 17,
                height: a.kind === "union" ? 19 : 17,
                borderRadius: "50%",
                background: a.kind === "union" ? T.accentSoft : T.accentPink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.serif,
                fontWeight: 600,
                fontSize: 10,
                color: T.accentInk,
              }}
            >
              {a.kind === "union" ? <Spark size={11} color={T.accent} /> : a.who.charAt(0)}
            </span>
            <div style={{ fontWeight: 500, fontSize: 14, color: T.ink, lineHeight: 1.4 }}>
              <b style={{ fontWeight: 600 }}>{a.who}</b> {a.text}
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{a.sub}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
