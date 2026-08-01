"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { SectionLabel } from "@/components/ui";

export default function PrivacyPage() {
  const t = useT();

  const rows: { title: string; body: string }[] = [
    { title: t.account.privacyAccountTitle, body: t.account.privacyAccountBody },
    { title: t.account.privacyWeddingTitle, body: t.account.privacyWeddingBody },
    { title: t.account.privacyGuestsTitle, body: t.account.privacyGuestsBody },
  ];

  return (
    <main className="u-main">
      <BackHeader title={t.account.privacyTitle} fallback="/account" />

      <div style={{ fontSize: 14, lineHeight: 1.6, color: T.muted }}>{t.account.privacyIntro}</div>

      <SectionLabel>{t.account.privacyWhatWeKeep}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div
            key={r.title}
            style={{
              padding: "14px 15px",
              borderBottom: i < rows.length - 1 ? `1px solid ${T.line}` : "none",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{r.title}</div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{r.body}</div>
          </div>
        ))}
      </div>

      <SectionLabel>{t.account.privacyDeleteTitle}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, padding: 15 }}>
        <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>{t.account.privacyDeleteBody}</div>
        <Link
          href="/account/wedding"
          style={{ display: "inline-block", marginTop: 10, fontWeight: 600, fontSize: 14, color: T.accentInk }}
        >
          {t.account.weddingTitle} →
        </Link>
      </div>
    </main>
  );
}
