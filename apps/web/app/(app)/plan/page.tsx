"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { PageHeader, Card, SectionLabel, Button, Chip, UnionNote } from "@/components/ui";
import { DemoBanner } from "@/components/SampleBadge";
import { getSample } from "@/lib/sample";
import { useT } from "@/lib/i18n/client";

export default function PlanPage() {
  const t = useT();
  const sample = getSample(t);
  const SUBNAV = [
    { href: "/plan/budget", label: t.plan.budget },
    { href: "/plan/weekend", label: t.plan.weekend },
    { href: "/plan/team", label: t.plan.team },
  ];
  return (
    <main className="u-main">
      <DemoBanner />
      <PageHeader kicker={t.plan.kicker} title={t.plan.title} />

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {SUBNAV.map((s) => (
          <Link key={s.href} href={s.href}>
            <Chip>{s.label} →</Chip>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <UnionNote>{t.plan.unionOrder}</UnionNote>
      </div>

      <SectionLabel style={{ color: T.accentInk }}>{t.plan.thisWeek}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {sample.thisWeek.map((item) => (
          <Card
            key={item.title}
            style={{
              padding: 16,
              border: item.primary
                ? `1px solid ${T.accentBorder}`
                : `1px solid ${T.line}`,
              boxShadow: item.primary
                ? "0 8px 20px rgba(67,53,58,.06)"
                : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                className="u-serif"
                style={{
                  fontWeight: 600,
                  fontSize: 20,
                  color: T.ink,
                  lineHeight: 1.15,
                }}
              >
                {item.title}
              </div>
              <span
                style={{
                  background:
                    item.owner === t.plan.ownerYou ? T.accentSoft : T.greenBg,
                  color:
                    item.owner === t.plan.ownerYou ? T.accentInk : T.greenInk,
                  fontWeight: 600,
                  fontSize: 10.5,
                  padding: "4px 9px",
                  borderRadius: 20,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {item.owner}
              </span>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
              {item.sub}
            </div>
            <Button
              variant={item.primary ? "primary" : "secondary"}
              style={{ width: "100%", marginTop: 13, height: 42, fontSize: 14 }}
            >
              {item.cta}
            </Button>
          </Card>
        ))}
      </div>

      <SectionLabel>{t.plan.bookSoon}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {sample.bookSoon.map((b) => (
          <Card
            key={b.title}
            style={{ display: "flex", alignItems: "center", gap: 13, padding: 15 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>
                {b.title}
              </div>
              <div style={{ fontSize: 12.5, color: T.faint, marginTop: 1 }}>
                {b.sub}
              </div>
            </div>
            <span
              style={{
                fontWeight: 600,
                fontSize: 12.5,
                color: T.accentInk,
                flexShrink: 0,
              }}
            >
              {t.common.handle}
            </span>
          </Card>
        ))}
      </div>

      <SectionLabel>{t.plan.later}</SectionLabel>
      <Card soft style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {sample.later.map((l) => (
          <div
            key={l}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#C7BAB2",
              }}
            />
            <span style={{ fontWeight: 500, fontSize: 14, color: T.muted }}>
              {l}
            </span>
          </div>
        ))}
      </Card>
    </main>
  );
}
