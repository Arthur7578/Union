"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { UnionNote } from "@/components/ui";
import { SAMPLE_SCHEDULE } from "@/lib/sample";

const DAYS = [
  { code: "FRI", label: "Welcome", active: false },
  { code: "SAT", label: "The day", active: true },
  { code: "SUN", label: "Brunch", active: false },
];

export default function WeekendPage() {
  return (
    <main className="u-main wide">
      <DemoBanner />
      <BackHeader title="The weekend" subtitle="Sept 19 – 21 · run-of-show" fallback="/plan" />

      {/* Day selector */}
      <div style={{ display: "flex", gap: 8 }}>
        {DAYS.map((d) => (
          <div
            key={d.code}
            style={{
              flex: 1,
              textAlign: "center",
              background: d.active ? T.accentSoft : "#fff",
              border: `1px solid ${d.active ? T.accentBorder : "rgba(67,53,58,.1)"}`,
              borderRadius: 14,
              padding: "9px 0",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 11, color: d.active ? T.ink : T.muted2 }}>{d.code}</div>
            <div style={{ fontWeight: 600, fontSize: 12, color: d.active ? T.accentInk : T.faint, marginTop: 2 }}>
              {d.label}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: 74, marginTop: 24 }}>
        <div style={{ position: "absolute", left: 62, top: 8, bottom: 14, width: 2, background: "rgba(67,53,58,.08)" }} />
        {SAMPLE_SCHEDULE.map((m, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 22 }}>
            <span
              style={{
                position: "absolute",
                left: m.accent ? -17 : -16,
                top: m.accent ? 3 : 4,
                width: m.accent ? 12 : 10,
                height: m.accent ? 12 : 10,
                borderRadius: "50%",
                background: m.accent ? T.accent : "#EFE7DF",
                border: m.accent ? "2px solid #fff" : "2px solid #A99A90",
                boxShadow: m.accent ? `0 0 0 2px ${T.accentBorder}` : "none",
              }}
            />
            <span
              className={m.accent ? "u-serif" : undefined}
              style={{
                position: "absolute",
                left: -74,
                top: 2,
                width: 52,
                textAlign: "right",
                fontWeight: m.accent ? 700 : 600,
                fontSize: m.accent ? 16 : 13,
                color: m.accent ? T.accentInk : T.faint,
              }}
            >
              {m.time}
            </span>
            <div
              className={m.accent ? "u-serif" : undefined}
              style={{ fontWeight: 600, fontSize: m.accent ? 19 : 15, color: T.ink }}
            >
              {m.title}
            </div>
            <div style={{ fontSize: 12.5, color: T.faint, marginTop: 2 }}>{m.sub}</div>
            <div style={{ marginTop: 7 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 600,
                  fontSize: 11,
                  color: "#8A6F74",
                  background: "#F3EAE3",
                  borderRadius: 7,
                  padding: "3px 8px",
                }}
              >
                {m.loc}
              </span>
            </div>
          </div>
        ))}
      </div>

      <UnionNote>
        Union sends each vendor only their slice of this — arrival time, location,
        contact — one week out.
      </UnionNote>
    </main>
  );
}
