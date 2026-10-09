"use client";

import React, { useState } from "react";
import type { Guest } from "@union/shared";
import { resetGuestAccess } from "@/lib/data";
import { guestEmailStatus } from "@/lib/guestEmailStatus";
import { useT } from "@/lib/i18n/client";
import { T } from "@/lib/theme";

/**
 * Under a guest's email on their page: whether the couple can rely on it,
 * whether the guest's invitation is secured, and a way to undo it when the
 * wrong person secured it from the group link.
 */
export function GuestEmailStatus({
  guest,
  onReset,
}: {
  guest: Pick<
    Guest,
    "id" | "first_name" | "email" | "email_source" | "email_confirmed_at" | "profile_id"
  >;
  /** Called after a reset so the page can reload the guest. */
  onReset: () => Promise<void> | void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const status = guestEmailStatus(guest);
  const secured = Boolean(guest.profile_id);
  const canReset = secured || guest.email_source === "guest";

  const label =
    status === "confirmed"
      ? t.guestEmailStatus.confirmed
      : status === "organiserUnconfirmed"
        ? t.guestEmailStatus.organiserUnconfirmed
        : status === "guestUnconfirmed"
          ? t.guestEmailStatus.guestUnconfirmed
          : t.guestEmailStatus.none;

  const reset = async () => {
    if (!confirm(t.guestEmailStatus.resetConfirm(guest.first_name))) return;
    setBusy(true);
    setNote(null);
    try {
      await resetGuestAccess(guest.id);
      await onReset();
      setNote({
        tone: "ok",
        text: `${t.guestEmailStatus.resetDone} ${t.guestEmailStatus.resetLimit}`,
      });
    } catch {
      setNote({ tone: "error", text: t.guestEmailStatus.resetError });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>
      <div
        style={{
          color: status === "confirmed" ? T.greenDeep : status === "none" ? T.faint : T.amberDeep,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {secured && <div style={{ color: T.muted, marginTop: 4 }}>{t.guestEmailStatus.secured}</div>}
      {canReset && (
        <button
          type="button"
          onClick={() => void reset()}
          disabled={busy}
          style={{
            marginTop: 6,
            padding: 0,
            border: "none",
            background: "none",
            color: T.accentInk,
            fontSize: 12.5,
            textDecoration: "underline",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {t.guestEmailStatus.resetButton}
        </button>
      )}
      {note && (
        <div style={{ marginTop: 6, color: note.tone === "ok" ? T.greenDeep : T.danger }}>
          {note.text}
        </div>
      )}
    </div>
  );
}
