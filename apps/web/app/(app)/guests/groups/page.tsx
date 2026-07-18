"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, SectionLabel, Avatar } from "@/components/ui";
import { SAMPLE_GROUPS, SAMPLE_ROLES } from "@/lib/sample";

export default function GroupsPage() {
  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Groups & roles" subtitle="118 guests · 6 groups" fallback="/guests" />

      <SectionLabel style={{ marginTop: 8 }}>Groups</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {SAMPLE_GROUPS.map((g) => (
          <Card key={g.name} style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: g.dot, border: `1.5px solid ${g.ring}` }} />
              <span className="u-serif" style={{ fontWeight: 600, fontSize: 24, color: T.ink, lineHeight: 1 }}>
                {g.count}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink, marginTop: 9 }}>{g.name}</div>
            <div style={{ fontSize: 11.5, color: T.faint }}>{g.sub}</div>
          </Card>
        ))}
        <Card soft style={{ padding: 14, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 22, color: T.sand, lineHeight: 0 }}>+</span>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: T.muted, marginTop: 14 }}>New group</div>
          <div style={{ fontSize: 11.5, color: T.faint }}>Name it, pick a colour</div>
        </Card>
      </div>

      <SectionLabel>The people with a role</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SAMPLE_ROLES.map((r) => (
          <Card key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
            <Avatar letter={r.monogram} tint="green" size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{r.name}</div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{r.sub}</div>
            </div>
            <span
              style={{
                background: T.blueBg,
                color: T.blueInk,
                fontWeight: 600,
                fontSize: 11,
                padding: "5px 11px",
                borderRadius: 20,
                flexShrink: 0,
              }}
            >
              {r.role}
            </span>
          </Card>
        ))}
      </div>
    </main>
  );
}
