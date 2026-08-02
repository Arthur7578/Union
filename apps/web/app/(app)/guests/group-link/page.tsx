"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, SectionLabel, Loading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export default function GroupLinkPage() {
  const t = useT();
  const { wedding } = useWedding();
  const [copied, setCopied] = useState(false);

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

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
        <div style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.6 }}>
          {t.groupLink.howItWorksBody}
        </div>
      </Card>
    </main>
  );
}
