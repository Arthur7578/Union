"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, SectionLabel, ProgressBar, Avatar, StatusPill } from "@/components/ui";
import { SAMPLE_ROOM_BLOCKS, SAMPLE_STAYS } from "@/lib/sample";

export default function StaysPage() {
  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Stays" subtitle="20 rooms held · 14 booked" fallback="/guests" />

      <SectionLabel style={{ marginTop: 8 }}>Room blocks</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {SAMPLE_ROOM_BLOCKS.map((b) => (
          <Card key={b.name} style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Avatar letter={b.name.charAt(0)} tint={b.tone === "green" ? "green" : "accent"} square />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="u-serif" style={{ fontWeight: 600, fontSize: 18, color: T.ink, lineHeight: 1.1 }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{b.sub}</div>
              </div>
              <StatusPill tone={b.tone === "green" ? "green" : "accent"}>{b.status}</StatusPill>
            </div>
            <div style={{ marginTop: 13 }}>
              <ProgressBar pct={b.pct} color={b.tone === "green" ? T.green : T.accent} />
            </div>
            <div style={{ fontWeight: 500, fontSize: 12, color: T.faint, marginTop: 8 }}>{b.note}</div>
          </Card>
        ))}
        <Card soft style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: T.sandBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 600,
              fontSize: 20,
              color: T.sand,
              lineHeight: 0,
            }}
          >
            +
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.muted }}>Add a budget option</div>
            <div style={{ fontSize: 12, color: T.faint }}>Union can hold a block for you</div>
          </div>
        </Card>
      </div>

      <SectionLabel>Who&apos;s staying where</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SAMPLE_STAYS.map((s) => (
          <Card key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
            <Avatar letter={s.name.charAt(0)} tint={s.tone === "green" ? "accent" : "amber"} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{s.name}</div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{s.sub}</div>
            </div>
            <span style={{ fontWeight: 600, fontSize: 11.5, color: s.tone === "green" ? T.greenInk : T.amberInk, flexShrink: 0 }}>
              {s.status}
            </span>
          </Card>
        ))}
      </div>

      <SectionLabel>Getting there · shuttle</SectionLabel>
      <Card style={{ padding: "4px 16px" }}>
        {[
          { t: "3:30", title: "Inn → Wildflower Barn", sub: "2 shuttles · 24 seats each" },
          { t: "11:15", title: "Barn → Inn (send-off)", sub: "2 loops after the sparklers" },
        ].map((r, i) => (
          <div
            key={r.t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "12px 0",
              borderBottom: i === 0 ? "1px solid rgba(67,53,58,.06)" : "none",
            }}
          >
            <span className="u-serif" style={{ fontWeight: 700, fontSize: 15, color: T.accentInk, width: 44, flexShrink: 0 }}>
              {r.t}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{r.title}</div>
              <div style={{ fontSize: 12, color: T.faint }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </Card>
    </main>
  );
}
