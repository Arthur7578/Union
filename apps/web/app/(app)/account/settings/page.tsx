"use client";

import React from "react";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner, SampleBadge } from "@/components/SampleBadge";
import { ChevronRight } from "@/components/icons";

export default function SettingsPage() {
  const t = useT();

  const CONNECTED: { key: string; label: string; status: string; on: boolean }[] = [
    { key: "calendar", label: t.account.connectedCalendar, status: t.account.connectedCalendarStatus, on: true },
    { key: "email", label: t.account.connectedEmail, status: t.account.connectedOn, on: true },
    { key: "contacts", label: t.account.connectedContacts, status: t.account.connectedOff, on: false },
  ];

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title={t.account.settingsTitle} subtitle={t.account.settingsKicker} fallback="/account" />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 4px 11px",
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
