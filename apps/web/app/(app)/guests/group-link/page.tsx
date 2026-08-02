"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { updateWedding } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, SectionLabel, Loading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export default function GroupLinkPage() {
  const t = useT();
  const { wedding, refresh } = useWedding();
  const [copied, setCopied] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  const toggleNameFallback = async (next: boolean) => {
    setFallbackBusy(true);
    try {
      await updateWedding(wedding.id, { allow_name_fallback: next });
      await refresh();
    } finally {
      setFallbackBusy(false);
    }
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://union.app";
  const link = `${origin}/join/${wedding.join_code}`;
  const partners =
    [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
    t.guests.theCouple;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    t.groupLink.whatsappMessage(partners, link),
  )}`;

  return (
    <main className="u-main">
      <BackHeader
        title={t.groupLink.title}
        subtitle={t.groupLink.subtitle}
        fallback="/guests"
      />

      <Card>
        <div
          style={{
            fontSize: 13,
            color: T.muted,
            wordBreak: "break-all",
            marginBottom: 16,
          }}
        >
          {link}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={copyLink}
            style={{ minHeight: 40, fontSize: 13, flex: 1 }}
          >
            {copied ? t.groupLink.copied : t.groupLink.copyButton}
          </Button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, textDecoration: "none" }}
          >
            <Button style={{ minHeight: 40, fontSize: 13, width: "100%" }}>
              {t.groupLink.whatsappButton}
            </Button>
          </a>
        </div>
      </Card>

      <SectionLabel>{t.groupLink.howItWorksTitle}</SectionLabel>
      <Card>
        <div style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.6, marginBottom: 16 }}>
          {t.groupLink.howItWorksBody}
        </div>
        <label
          htmlFor="allow-name-fallback"
          style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
        >
          <input
            id="allow-name-fallback"
            type="checkbox"
            checked={wedding.allow_name_fallback}
            disabled={fallbackBusy}
            onChange={(e) => toggleNameFallback(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.ink }}>
              {t.groupLink.allowNameFallbackLabel}
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
              {t.groupLink.allowNameFallbackHint}
            </div>
          </div>
        </label>
      </Card>
    </main>
  );
}
