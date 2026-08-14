"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { fetchGuestEmailCoverage, updateWedding } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, SectionLabel, Loading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export default function GroupLinkPage() {
  const t = useT();
  const { wedding, refresh } = useWedding();
  const [copied, setCopied] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [coverage, setCoverage] = useState<{
    withEmail: number;
    total: number;
  } | null>(null);
  const weddingId = wedding?.id;

  useEffect(() => {
    if (!weddingId) return;
    let active = true;
    void fetchGuestEmailCoverage(weddingId)
      .then((result) => {
        if (active) setCoverage(result);
      })
      .catch(() => {
        if (active) setCoverage(null);
      });
    return () => {
      active = false;
    };
  }, [weddingId]);

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  const setAuthMode = async (next: "contact" | "otp") => {
    setModeBusy(true);
    try {
      await updateWedding(wedding.id, { guest_join_auth_mode: next });
      await refresh();
    } finally {
      setModeBusy(false);
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
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, marginBottom: 12 }}>
          {t.groupLink.authModeTitle}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <AuthModeOption
            id="guest-auth-contact"
            checked={wedding.guest_join_auth_mode === "contact"}
            disabled={modeBusy}
            label={t.groupLink.contactModeLabel}
            hint={t.groupLink.contactModeHint}
            onChange={() => void setAuthMode("contact")}
          />
          <AuthModeOption
            id="guest-auth-otp"
            checked={wedding.guest_join_auth_mode === "otp"}
            disabled={modeBusy}
            label={t.groupLink.otpModeLabel}
            hint={t.groupLink.otpModeHint}
            warning={
              coverage
                ? t.groupLink.otpCoverage(coverage.withEmail, coverage.total)
                : undefined
            }
            onChange={() => void setAuthMode("otp")}
          />
        </div>
      </Card>
    </main>
  );
}

function AuthModeOption({
  id,
  checked,
  disabled,
  label,
  hint,
  warning,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled: boolean;
  label: string;
  hint: string;
  warning?: string;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        cursor: disabled ? "wait" : "pointer",
        border: checked ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <input
        id={id}
        name="guest-join-auth-mode"
        type="radio"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ marginTop: 3 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 4, lineHeight: 1.45 }}>
          {hint}
        </div>
        {warning && (
          <div style={{ fontSize: 12, color: "#9a5b23", marginTop: 8, lineHeight: 1.45 }}>
            {warning}
          </div>
        )}
      </div>
    </label>
  );
}
