"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, Button } from "@/components/ui";
import { Spark } from "@/components/icons";
import { getSample } from "@/lib/sample";
import { useT } from "@/lib/i18n/client";

export default function SearchActivePage() {
  const t = useT();
  const s = getSample(t).search;
  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader
        title={s.title}
        subtitle={s.started}
        fallback="/vendors"
        right={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: T.amberBg,
              borderRadius: 20,
              padding: "5px 10px",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber }} />
            <span style={{ fontWeight: 600, fontSize: 11, color: T.amberInk }}>
              {t.common.live}
            </span>
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
          <span
            style={{
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.accent,
            }}
          >
            {t.vendors.unionIsOnIt}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <Stat value={s.reachedOut} label={t.vendors.reachedOut} />
          <VLine />
          <Stat value={s.replied} label={t.vendors.replied} />
          <VLine />
          <Stat value={s.finalists} label={t.vendors.finalists} color={T.greenInk} />
        </div>
      </div>

      {/* Decision card */}
      <Card
        style={{
          marginTop: 18,
          padding: 18,
          border: `1px solid ${T.accentBorder}`,
          boxShadow: "0 10px 26px rgba(67,53,58,.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Spark size={14} color={T.accent} />
          <span
            style={{
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.accent,
            }}
          >
            {t.vendors.oneQuickCall}
          </span>
        </div>
        <div
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: T.ink,
            marginTop: 10,
          }}
        >
          {t.vendors.searchAsk.before} <b>{t.vendors.searchAsk.priceOver}</b>
          {t.vendors.searchAsk.middle}
          <i>{t.vendors.searchAsk.italic}</i>
          {t.vendors.searchAsk.end}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <Button style={{ flex: 1, fontSize: 14 }}>
            {t.vendors.stretchBudget}
          </Button>
          <Button variant="secondary" style={{ flex: 1, fontSize: 14 }}>
            {t.vendors.holdBudget}
          </Button>
        </div>
      </Card>

      {/* Activity timeline */}
      <div className="u-section-label" style={{ padding: "24px 4px 4px" }}>
        {t.vendors.activity}
      </div>
      <div style={{ position: "relative", paddingLeft: 26, marginTop: 8 }}>
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 6,
            bottom: 16,
            width: 2,
            background: "rgba(67,53,58,.08)",
          }}
        />
        {s.timeline.map((step, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 18 }}>
            <span
              style={{
                position: "absolute",
                left: -24,
                top: 3,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: step.done ? T.greenBg : T.amberBg,
                border: `2px solid ${step.done ? T.green : T.amber}`,
              }}
            />
            <div style={{ fontWeight: 500, fontSize: 14, color: T.ink }}>
              {step.text}
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
              {step.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <Link href="/vendors" className="u-link">
          {t.vendors.browseMyself}
        </Link>
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
  color = T.ink,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div
        className="u-serif"
        style={{ fontWeight: 600, fontSize: 32, color, lineHeight: 1 }}
      >
        {value}
      </div>
      <div
        style={{ fontWeight: 500, fontSize: 11, color: T.muted2, marginTop: 3 }}
      >
        {label}
      </div>
    </div>
  );
}

function VLine() {
  return <div style={{ width: 1, background: "rgba(67,53,58,.1)" }} />;
}
