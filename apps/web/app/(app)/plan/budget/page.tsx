"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { SectionLabel, ProgressBar, UnionNote } from "@/components/ui";
import { money } from "@/lib/format";
import { SAMPLE_BUDGET, SAMPLE_COUPLE } from "@/lib/sample";

const TONE: Record<string, string> = {
  green: T.green,
  accent: T.accent,
  faint: "#C7BAB2",
};

export default function BudgetPage() {
  const { budgetTotal, budgetCommitted } = SAMPLE_COUPLE;
  const overallPct = Math.round((budgetCommitted / budgetTotal) * 100);
  const room = budgetTotal - budgetCommitted;

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Budget" subtitle="Sample figures" fallback="/plan" />

      <div style={{ padding: "0 2px" }}>
        <div className="u-kicker">Committed of {money(budgetTotal)}</div>
        <div
          className="u-serif"
          style={{ fontWeight: 600, fontSize: 52, lineHeight: 1, color: T.ink, marginTop: 7 }}
        >
          {money(budgetCommitted)}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <ProgressBar pct={overallPct} height={12} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, padding: "0 2px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
        <span style={{ fontWeight: 500, fontSize: 13.5, color: T.ink2 }}>
          <b style={{ color: T.greenInk }}>{money(room)} under</b> your ceiling —
          you have room to breathe.
        </span>
      </div>

      <div style={{ marginTop: 18 }}>
        <UnionNote>
          Union found <b style={{ color: T.ink }}>$1,180 in savings</b> this month
          through negotiation.
        </UnionNote>
      </div>

      <SectionLabel>By category</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "0 4px" }}>
        {SAMPLE_BUDGET.map((c) => (
          <div key={c.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 500, fontSize: 15, color: T.ink }}>{c.label}</span>
              <span style={{ fontSize: 13, color: T.faint }}>
                {c.note ? `${c.note} · ` : ""}
                <b style={{ color: T.ink }}>{money(c.spent)}</b>
                {c.cap ? ` / ${money(c.cap)}` : ""}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar pct={c.pct} color={TONE[c.tone]} height={7} track="rgba(67,53,58,.07)" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
