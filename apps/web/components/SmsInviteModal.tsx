"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Button } from "@/components/ui";

/**
 * One-shot preview / edit modal for an SMS invite. `initialMessage` is
 * the template already resolved with this guest's variables — the
 * organiser may tweak it before sending; edits are dispatch-only and
 * never written back to the wedding-level template.
 */
export function SmsInviteModal({
  initialMessage,
  recipient,
  sender,
  busy,
  error,
  onCancel,
  onSend,
}: {
  initialMessage: string;
  recipient: string;
  sender: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSend: (message: string) => void;
}) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const charCount = message.length;
  const gsm = /^[A-Za-z0-9 @£$¥èéùìòÇ\r\nØøÅå_ÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/.test(
    message,
  );
  const perSegment = gsm ? 160 : 70;
  const segments = Math.max(1, Math.ceil(charCount / perSegment));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send SMS invite"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,15,0.45)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 18,
          padding: 20,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 24px 60px rgba(20,15,15,.25)",
          maxHeight: "100vh",
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>
          Send SMS invite
        </div>
        <div style={{ fontSize: 12.5, color: T.faint, marginTop: 4 }}>
          Review and tweak the message. Edits here don't overwrite your
          template — they only apply to this send.
        </div>

        <div
          style={{
            display: "grid",
            gap: 4,
            marginTop: 14,
            fontSize: 12,
            color: T.muted,
          }}
        >
          <div>
            <span style={{ color: T.faint }}>To </span>
            <b style={{ color: T.ink }}>{recipient || "—"}</b>
          </div>
          <div>
            <span style={{ color: T.faint }}>From </span>
            <b style={{ color: T.ink }}>{sender || "—"}</b>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
          <label htmlFor="sms-final">Message</label>
          <textarea
            id="sms-final"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            style={{
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: T.sans,
            }}
            disabled={busy}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: T.faint,
            marginTop: 6,
          }}
        >
          <span>{charCount} chars</span>
          <span>
            {segments} SMS · {gsm ? "GSM-7" : "Unicode"}
          </span>
        </div>

        {error && (
          <div className="error" style={{ marginTop: 14, marginBottom: 0 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSend(message)}
            disabled={busy || message.trim().length === 0}
            style={{ flex: 1 }}
          >
            {busy ? "Sending…" : "Confirm send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
