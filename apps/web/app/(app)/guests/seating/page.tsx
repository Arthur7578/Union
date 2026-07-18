"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, UnionNote, Button } from "@/components/ui";

type Table = { n: string; x: number; y: number; bg: string; ring: string; fg: string; dashed?: boolean };

const TABLES: Table[] = [
  { n: "1", x: 19, y: 33, bg: "#F2E1E0", ring: "#C79BA0", fg: T.accentInk },
  { n: "2", x: 81, y: 33, bg: "#E7EFE6", ring: "#A9C0AC", fg: T.greenInk },
  { n: "3", x: 13, y: 56, bg: "#FBEEE2", ring: "#DDB27C", fg: T.amberInk },
  { n: "4", x: 87, y: 56, bg: "#F2E1E0", ring: "#C79BA0", fg: T.accentInk },
  { n: "5", x: 24, y: 82, bg: "#E7EFE6", ring: "#A9C0AC", fg: T.greenInk },
  { n: "6", x: 50, y: 87, bg: "#FBEEE2", ring: "#DDB27C", fg: T.amberInk },
  { n: "7", x: 76, y: 82, bg: "#F4EFE9", ring: "#C1B4AD", fg: T.sand, dashed: true },
];

const LEGEND = [
  { label: "Family", bg: "#F2E1E0", ring: "#C79BA0" },
  { label: "Friends", bg: "#E7EFE6", ring: "#A9C0AC" },
  { label: "Work & neighbors", bg: "#FBEEE2", ring: "#DDB27C" },
  { label: "Open seats", bg: "#F4EFE9", ring: "#C1B4AD", dashed: true },
];

export default function SeatingPage() {
  const [view, setView] = useState<"reception" | "ceremony">("reception");

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Seating" subtitle="86 guests placed" fallback="/guests" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, background: "#EFE7DF", borderRadius: 14, padding: 4 }}>
        {(["ceremony", "reception"] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                textAlign: "center",
                cursor: "pointer",
                background: on ? "#fff" : "transparent",
                borderRadius: 11,
                border: "none",
                padding: "9px 0",
                fontWeight: 600,
                fontSize: 13,
                color: on ? T.ink : T.faint,
                boxShadow: on ? "0 2px 6px rgba(67,53,58,.06)" : "none",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      {view === "reception" ? (
        <>
          <div
            style={{
              marginTop: 16,
              position: "relative",
              height: 320,
              borderRadius: 22,
              background: "#F7F0EA",
              border: "1px solid rgba(67,53,58,.09)",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 11, left: 14, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C1B4AD" }}>
              The barn · head of room
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "14%",
                transform: "translate(-50%,-50%)",
                width: 92,
                height: 30,
                borderRadius: 8,
                background: T.accentSoft,
                border: `1.5px solid ${T.accentBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 10,
                color: T.accentInk,
              }}
            >
              Sweethearts
            </div>
            {TABLES.map((t) => (
              <div
                key={t.n}
                style={{
                  position: "absolute",
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  transform: "translate(-50%,-50%)",
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: t.bg,
                  border: `1.5px ${t.dashed ? "dashed" : "solid"} ${t.ring}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.serif,
                  fontWeight: 700,
                  fontSize: 16,
                  color: t.fg,
                }}
              >
                {t.n}
              </div>
            ))}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "57%",
                transform: "translate(-50%,-50%)",
                width: 96,
                height: 66,
                border: "1.5px dashed rgba(67,53,58,.2)",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontWeight: 600,
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.label,
                lineHeight: 1.35,
              }}
            >
              Dance
              <br />
              floor
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 13, padding: "0 4px" }}>
            {LEGEND.map((l) => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: l.bg, border: `1.5px ${l.dashed ? "dashed" : "solid"} ${l.ring}` }} />
                <span style={{ fontWeight: 500, fontSize: 11.5, color: T.muted2 }}>{l.label}</span>
              </span>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <UnionNote action={<Button style={{ minHeight: 38, fontSize: 12.5, padding: "0 13px" }}>Arrange</Button>}>
              Table 7 needs 6 — want me to seat the <b style={{ color: T.ink }}>Okafor</b> party here so families stay together?
            </UnionNote>
          </div>
        </>
      ) : (
        <>
          <Card style={{ marginTop: 16, background: "#F7F0EA", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 132,
                  height: 54,
                  border: `2px solid ${T.accentBorder}`,
                  borderBottom: "none",
                  borderRadius: "132px 132px 0 0",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 8,
                  fontWeight: 600,
                  fontSize: 9.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: T.accentInk,
                }}
              >
                The arch
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 6px 10px" }}>
              <span style={{ fontWeight: 600, fontSize: 11, color: T.muted2 }}>Maya&apos;s side</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: T.muted2 }}>Daniel&apos;s side</span>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1.5px dashed rgba(67,53,58,.16)", transform: "translateX(-50%)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 9, position: "relative" }}>
                {Array.from({ length: 6 }).map((_, r) => (
                  <div key={r} style={{ display: "flex", gap: 26 }}>
                    {[0, 1].map((c) => (
                      <div
                        key={c}
                        style={{
                          flex: 1,
                          height: r === 0 ? 18 : 16,
                          borderRadius: r === 0 ? 6 : 5,
                          background: r === 0 ? T.accentSoft : "#EBE1D8",
                          border: r === 0 ? `1px solid ${T.accentBorder}` : "1px solid rgba(67,53,58,.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: 8.5,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: T.accentInk,
                        }}
                      >
                        {r === 0 ? "Reserved" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
            <Card style={{ flex: 1, padding: "12px 14px" }}>
              <div className="u-serif" style={{ fontWeight: 600, fontSize: 22, color: T.ink, lineHeight: 1 }}>~100</div>
              <div style={{ fontWeight: 500, fontSize: 11.5, color: T.faint, marginTop: 3 }}>seats set</div>
            </Card>
            <Card style={{ flex: 1, padding: "12px 14px" }}>
              <div className="u-serif" style={{ fontWeight: 600, fontSize: 22, color: T.ink, lineHeight: 1 }}>4:00</div>
              <div style={{ fontWeight: 500, fontSize: 11.5, color: T.faint, marginTop: 3 }}>on the lawn</div>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
