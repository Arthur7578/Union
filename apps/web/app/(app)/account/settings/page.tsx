"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner, SampleBadge } from "@/components/SampleBadge";
import { ChevronRight } from "@/components/icons";

type Autonomy = "ask" | "suggest" | "auto";

export default function SettingsPage() {
  const t = useT();
  const [autonomy, setAutonomy] = useState<Autonomy>("ask");

  const AUTONOMY: { key: Autonomy; label: string; desc: string }[] = [
    { key: "ask", label: t.account.autonomyAsk, desc: t.account.autonomyDescAsk },
    { key: "suggest", label: t.account.autonomySuggest, desc: t.account.autonomyDescSuggest },
    { key: "auto", label: t.account.autonomyAuto, desc: t.account.autonomyDescAuto },
  ];
  const current = AUTONOMY.find((a) => a.key === autonomy)!;

  const CONNECTED: { key: string; label: string; status: string; on: boolean }[] = [
    { key: "calendar", label: t.account.connectedCalendar, status: t.account.connectedCalendarStatus, on: true },
    { key: "email", label: t.account.connectedEmail, status: t.account.connectedOn, on: true },
    { key: "contacts", label: t.account.connectedContacts, status: t.account.connectedOff, on: false },
  ];

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title={t.account.settingsTitle} subtitle={t.account.settingsKicker} fallback="/account" />

      <div style={{ borderRadius: 22, background: T.surface, border: `1px solid ${T.line}`, padding: 16 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.accentInk,
          }}
        >
          {t.account.autonomyLabel}
        </div>
        <div
          role="tablist"
          aria-label={t.account.autonomyLabel}
          style={{ display: "flex", gap: 5, background: "#F1EDE7", borderRadius: 14, padding: 4, marginTop: 11 }}
        >
          {AUTONOMY.map((a) => {
            const on = a.key === autonomy;
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setAutonomy(a.key)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  cursor: "pointer",
                  background: on ? "#fff" : "transparent",
                  borderRadius: 11,
                  border: "none",
                  padding: "9px 4px",
                  fontWeight: 600,
                  fontSize: 13,
                  color: on ? T.ink : T.faint,
                  boxShadow: on ? "0 2px 6px rgba(67,53,58,.06)" : "none",
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 12, lineHeight: 1.5 }}>{current.desc}</div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 4px 11px",
          marginTop: 24,
        }}
      >
        <div className="u-section-label">{t.account.connectedSection}</div>
        <SampleBadge />
      </div>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        {CONNECTED.map((c, i) => (
          <div
            key={c.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 15px",
              borderBottom: i < CONNECTED.length - 1 ? `1px solid ${T.line}` : "none",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>{c.label}</span>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: c.on ? T.greenInk : T.label }}>
              {c.status}
            </span>
            <ChevronRight size={16} stroke="#CBBCB6" />
          </div>
        ))}
      </div>
    </main>
  );
}
