"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { PageHeader, Card, SectionLabel, Button, Chip, UnionNote } from "@/components/ui";
import { DemoBanner } from "@/components/SampleBadge";
import { SAMPLE_THIS_WEEK, SAMPLE_BOOK_SOON, SAMPLE_LATER } from "@/lib/sample";

const SUBNAV = [
  { href: "/plan/budget", label: "Budget" },
  { href: "/plan/weekend", label: "The weekend" },
  { href: "/plan/team", label: "Plan together" },
];

export default function PlanPage() {
  return (
    <main className="u-main">
      <DemoBanner />
      <PageHeader kicker="68 days out" title="What's next" />

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {SUBNAV.map((s) => (
          <Link key={s.href} href={s.href}>
            <Chip>{s.label} →</Chip>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <UnionNote>
          These are ordered by what has the least breathing room. Hand any of them
          to me.
        </UnionNote>
      </div>

      <SectionLabel style={{ color: T.accentInk }}>This week</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {SAMPLE_THIS_WEEK.map((t) => (
          <Card
            key={t.title}
            style={{
              padding: 16,
              border: t.primary ? `1px solid ${T.accentBorder}` : `1px solid ${T.line}`,
              boxShadow: t.primary ? "0 8px 20px rgba(67,53,58,.06)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div className="u-serif" style={{ fontWeight: 600, fontSize: 20, color: T.ink, lineHeight: 1.15 }}>
                {t.title}
              </div>
              <span
                style={{
                  background: t.owner === "You" ? T.accentSoft : T.greenBg,
                  color: t.owner === "You" ? T.accentInk : T.greenInk,
                  fontWeight: 600,
                  fontSize: 10.5,
                  padding: "4px 9px",
                  borderRadius: 20,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {t.owner}
              </span>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>{t.sub}</div>
            <Button
              variant={t.primary ? "primary" : "secondary"}
              style={{ width: "100%", marginTop: 13, height: 42, fontSize: 14 }}
            >
              {t.cta}
            </Button>
          </Card>
        ))}
      </div>

      <SectionLabel>Book soon · Union suggests</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {SAMPLE_BOOK_SOON.map((b) => (
          <Card key={b.title} style={{ display: "flex", alignItems: "center", gap: 13, padding: 15 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: T.faint, marginTop: 1 }}>{b.sub}</div>
            </div>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: T.accentInk, flexShrink: 0 }}>Handle</span>
          </Card>
        ))}
      </div>

      <SectionLabel>Later — I&apos;ll remind you</SectionLabel>
      <Card soft style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {SAMPLE_LATER.map((l) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C7BAB2" }} />
            <span style={{ fontWeight: 500, fontSize: 14, color: T.muted }}>{l}</span>
          </div>
        ))}
      </Card>
    </main>
  );
}
