"use client";

import React from "react";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { UnionNote } from "@/components/ui";
import { ChevronRight } from "@/components/icons";
import { ujShowWidget, type UserJotSection } from "@/lib/userjot";

/**
 * Help & feedback — the in-app home for UserJot.
 *
 * The SDK's floating bubble is switched off (it covered the tab bar and every
 * bottom-anchored action), so these rows are how the panel gets opened. Each
 * one drops the reader straight into the section they asked for.
 */
export default function FeedbackPage() {
  const t = useT();

  const ROWS: { key: UserJotSection; title: string; sub: string }[] = [
    { key: "feedback", title: t.feedback.shareTitle, sub: t.feedback.shareSub },
    { key: "roadmap", title: t.feedback.roadmapTitle, sub: t.feedback.roadmapSub },
    { key: "updates", title: t.feedback.updatesTitle, sub: t.feedback.updatesSub },
  ];

  return (
    <main className="u-main">
      <BackHeader
        title={t.feedback.title}
        subtitle={t.feedback.kicker}
        fallback="/account"
      />

      <UnionNote>{t.feedback.intro}</UnionNote>

      <div
        style={{
          marginTop: 18,
          borderRadius: 18,
          background: T.surface,
          border: `1px solid ${T.line}`,
          overflow: "hidden",
        }}
      >
        {ROWS.map((row, i) => (
          <button
            key={row.key}
            onClick={() => ujShowWidget(row.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px 15px",
              width: "100%",
              border: "none",
              borderBottom: i < ROWS.length - 1 ? `1px solid ${T.line}` : "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                {row.title}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                {row.sub}
              </div>
            </div>
            <ChevronRight size={16} stroke="#CBBCB6" />
          </button>
        ))}
      </div>
    </main>
  );
}
