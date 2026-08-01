"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { SectionLabel, Switch } from "@/components/ui";
import { ChevronRight } from "@/components/icons";

type PrefKey =
  | "vendorReplies"
  | "guestRsvps"
  | "unionActions"
  | "coOrganiserActivity"
  | "weeklyDigest"
  | "quietHours";

const DEFAULTS: Record<PrefKey, boolean> = {
  vendorReplies: true,
  guestRsvps: true,
  unionActions: false,
  coOrganiserActivity: true,
  weeklyDigest: true,
  quietHours: true,
};

export default function NotificationsPage() {
  const t = useT();
  const [prefs, setPrefs] = useState(DEFAULTS);

  const toggle = (key: PrefKey) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const NOTIFY: { key: PrefKey; title: string; sub: string }[] = [
    { key: "vendorReplies", title: t.account.notifVendorReplies, sub: t.account.notifVendorRepliesSub },
    { key: "guestRsvps", title: t.account.notifGuestRsvps, sub: t.account.notifGuestRsvpsSub },
    { key: "unionActions", title: t.account.notifUnionActions, sub: t.account.notifUnionActionsSub },
    { key: "coOrganiserActivity", title: t.account.notifCoOrganiser, sub: t.account.notifCoOrganiserSub },
  ];

  const RHYTHM: { key: PrefKey; title: string; sub: string }[] = [
    { key: "weeklyDigest", title: t.account.notifWeeklyDigest, sub: t.account.notifWeeklyDigestSub },
    { key: "quietHours", title: t.account.notifQuietHours, sub: t.account.notifQuietHoursSub },
  ];

  const row = (key: PrefKey, title: string, sub: string, isLast: boolean) => (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 15px",
        borderBottom: isLast ? "none" : `1px solid ${T.line}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{sub}</div>
      </div>
      <Switch on={prefs[key]} onChange={() => toggle(key)} label={title} />
    </div>
  );

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title={t.account.notifTitle} subtitle={t.account.settingsRow} fallback="/account/settings" />

      <SectionLabel style={{ marginTop: 0 }}>{t.account.notifyWhen}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        {NOTIFY.map((n, i) => row(n.key, n.title, n.sub, i === NOTIFY.length - 1))}
      </div>

      <SectionLabel>{t.account.rhythm}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        {RHYTHM.map((n, i) => row(n.key, n.title, n.sub, i === RHYTHM.length - 1))}
      </div>

      <SectionLabel>{t.account.channels}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 15px", borderBottom: `1px solid ${T.line}` }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>{t.account.channelPush}</span>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: T.greenInk }}>{t.account.channelOn}</span>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 15px" }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>{t.account.channelEmail}</span>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: T.label }}>{t.account.channelDigestOnly}</span>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </div>
      </div>
    </main>
  );
}
