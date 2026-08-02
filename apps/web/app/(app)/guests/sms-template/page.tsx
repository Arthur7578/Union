"use client";

import React, { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { updateWedding } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, SectionLabel, Loading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_PLACEHOLDERS,
  resolveSmsTemplate,
} from "@/lib/sms";

export default function SmsTemplatePage() {
  const t = useT();
  const { wedding, refresh } = useWedding();
  const [sender, setSender] = useState("");
  const [template, setTemplate] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    setSender(wedding.sms_sender ?? "");
    setTemplate(wedding.sms_template ?? DEFAULT_SMS_TEMPLATE);
    setApiKey(wedding.sms_brevo_api_key ?? "");
  }, [wedding]);

  const previewOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://union.app";

  const preview = useMemo(
    () =>
      resolveSmsTemplate(template, {
        guest_first_name: "Priya",
        guest_access_link: `${previewOrigin}/guest/sample-token`,
        partner_1_first_name: wedding?.partner_one || "Maya",
        partner_2_first_name: wedding?.partner_two || "Daniel",
      }),
    [template, wedding?.partner_one, wedding?.partner_two, previewOrigin],
  );

  const charCount = preview.length;
  // A GSM-7 SMS is 160 chars; UCS-2 (any accented / non-latin char) is 70.
  // Cheap heuristic: any char outside the basic GSM range → UCS-2.
  const gsm = /^[A-Za-z0-9 @£$¥èéùìòÇ\r\nØøÅå_ÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/.test(
    preview,
  );
  const perSegment = gsm ? 160 : 70;
  const segments = Math.max(1, Math.ceil(charCount / perSegment));

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateWedding(wedding.id, {
        sms_sender: sender.trim() || null,
        sms_template: template,
        sms_brevo_api_key: apiKey.trim() || null,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const insertPlaceholder = (key: string) => {
    const ta = document.getElementById("sms-template") as HTMLTextAreaElement | null;
    const insertion = `{{${key}}}`;
    if (!ta) {
      setTemplate((prev) => prev + insertion);
      return;
    }
    const start = ta.selectionStart ?? template.length;
    const end = ta.selectionEnd ?? template.length;
    const next = template.slice(0, start) + insertion + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + insertion.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  return (
    <main className="u-main">
      <BackHeader
        title={t.smsTemplate.title}
        subtitle={t.smsTemplate.subtitle}
        fallback="/guests"
      />

      <form onSubmit={save}>
        <SectionLabel style={{ marginTop: 0 }}>{t.smsTemplate.apiKeyLabel}</SectionLabel>
        <Card>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sms-api-key">{t.smsTemplate.apiKeyField}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="sms-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t.smsTemplate.apiKeyPlaceholder}
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowApiKey((v) => !v)}
                style={{ minHeight: 42, fontSize: 12.5, padding: "0 12px" }}
              >
                {showApiKey ? t.smsTemplate.apiKeyHide : t.smsTemplate.apiKeyShow}
              </Button>
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
              {t.smsTemplate.apiKeyHint}{" "}
              <a
                href="https://app.brevo.com/settings/keys/api"
                target="_blank"
                rel="noreferrer"
                style={{ color: T.ink, textDecoration: "underline" }}
              >
                {t.smsTemplate.apiKeyLinkText}
              </a>
              . {t.smsTemplate.apiKeyCreditsHint}
            </div>
          </div>
        </Card>

        <SectionLabel>{t.smsTemplate.senderLabel}</SectionLabel>
        <Card>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sms-sender">{t.smsTemplate.senderField}</label>
            <input
              id="sms-sender"
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={t.smsTemplate.senderPlaceholder}
              maxLength={20}
            />
            <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
              {t.smsTemplate.senderHint}
            </div>
          </div>
        </Card>

        <SectionLabel>{t.smsTemplate.templateLabel}</SectionLabel>
        <Card>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>
            {t.smsTemplate.templateHint}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {SMS_PLACEHOLDERS.map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => insertPlaceholder(key)}
                style={{
                  border: "1px solid rgba(67,53,58,.12)",
                  background: "rgba(224,204,177,.35)",
                  borderRadius: 20,
                  padding: "5px 10px",
                  fontSize: 12,
                  color: T.ink,
                  cursor: "pointer",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
                title={t.smsTemplate.placeholderTitle(key)}
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sms-template" className="u-visually-hidden">
              {t.smsTemplate.templateLabel}
            </label>
            <textarea
              id="sms-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={7}
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            />
          </div>
        </Card>

        <SectionLabel>{t.smsTemplate.previewLabel}</SectionLabel>
        <Card>
          <div style={{ fontSize: 12, color: T.faint, marginBottom: 8 }}>
            {t.smsTemplate.previewHint}
          </div>
          <div
            style={{
              background: "#F5EFE6",
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 14,
              color: T.ink,
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
              border: "1px solid rgba(67,53,58,.08)",
            }}
          >
            {preview || (
              <span style={{ color: T.faint, fontStyle: "italic" }}>
                {t.smsTemplate.previewEmpty}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: T.faint,
              marginTop: 8,
            }}
          >
            <span>{t.smsTemplate.charCount(charCount)}</span>
            <span>{t.smsTemplate.segmentCount(segments, gsm ? "GSM-7" : "Unicode")}</span>
          </div>
        </Card>

        {error && (
          <div className="error" style={{ margin: "12px 0" }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? t.common.saving : saved ? t.smsTemplate.saved : t.smsTemplate.save}
          </Button>
        </div>
      </form>
    </main>
  );
}
