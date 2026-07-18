"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, Button } from "@/components/ui";
import { Spark } from "@/components/icons";
import { SAMPLE_SEARCH } from "@/lib/sample";

export default function SearchActivePage() {
  const s = SAMPLE_SEARCH;
  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader
        title={s.title}
        subtitle={s.started}
        fallback="/vendors"
        right={
          <span style={{ display: "flex", alignItems: "center", gap: 5, background: T.amberBg, borderRadius: 20, padding: "5px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber }} />
            <span style={{ fontWeight: 600, fontSize: 11, color: T.amberInk }}>Live</span>
          </span>
        }
      />

      {/* Stat card */}
      <div
        style={{
          borderRadius: 24,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: 20,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spark size={16} color={T.accent} />
          <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>
            Union is on it
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <Stat value={s.reachedOut} label="reached out" />
          <VLine />
          <Stat value={s.replied} label="replied" />
          <VLine />
          <Stat value={s.finalists} label="finalists" color={T.greenInk} />
        </div>
      </div>

      {/* Decision card */}
      <Card style={{ marginTop: 18, padding: 18, border: `1px solid ${T.accentBorder}`, boxShadow: "0 10px 26px rgba(67,53,58,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Spark size={14} color={T.accent} />
          <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>
            One quick call
          </span>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55, color: T.ink, marginTop: 10 }}>
          The two I love most come in around <b>$5,400</b> — just over your range,
          but both include a second shooter <i>and</i> an album. Want me to stretch
          the budget, or hold firm at $5,000?
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <Button style={{ flex: 1, fontSize: 14 }}>Stretch to $5,400</Button>
          <Button variant="secondary" style={{ flex: 1, fontSize: 14 }}>Hold at $5,000</Button>
        </div>
      </Card>

      {/* Activity timeline */}
      <div className="u-section-label" style={{ padding: "24px 4px 4px" }}>Activity</div>
      <div style={{ position: "relative", paddingLeft: 26, marginTop: 8 }}>
        <div style={{ position: "absolute", left: 8, top: 6, bottom: 16, width: 2, background: "rgba(67,53,58,.08)" }} />
        {s.timeline.map((t, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 18 }}>
            <span
              style={{
                position: "absolute",
                left: -24,
                top: 3,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: t.done ? T.greenBg : T.amberBg,
                border: `2px solid ${t.done ? T.green : T.amber}`,
              }}
            />
            <div style={{ fontWeight: 500, fontSize: 14, color: T.ink }}>{t.text}</div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <Link href="/vendors" className="u-link">Browse all photographers myself →</Link>
      </div>
    </main>
  );
}

function Stat({ value, label, color = T.ink }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div className="u-serif" style={{ fontWeight: 600, fontSize: 32, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontWeight: 500, fontSize: 11, color: T.muted2, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function VLine() {
  return <div style={{ width: 1, background: "rgba(67,53,58,.1)" }} />;
}
