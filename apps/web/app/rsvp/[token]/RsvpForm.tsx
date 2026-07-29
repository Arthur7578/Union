"use client";

import { useState } from "react";
import type { Database } from "@union/shared";
import { getSupabase } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Invitation =
  Database["public"]["Functions"]["get_invitation"]["Returns"][number];

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === "fr" ? "fr-FR" : "en-US";
  return d.toLocaleDateString(tag, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function RsvpForm({
  token,
  invitation,
}: {
  token: string;
  invitation: Invitation;
}) {
  const { t, locale } = useLocale();
  const alreadyResponded = invitation.rsvp_status !== "pending";
  const [choice, setChoice] = useState<"attending" | "declined" | null>(
    alreadyResponded
      ? (invitation.rsvp_status as "attending" | "declined")
      : null,
  );
  const [numAttending, setNumAttending] = useState<number>(
    invitation.num_attending ?? invitation.party_size,
  );
  const [dietary, setDietary] = useState(invitation.dietary_notes ?? "");
  const [message, setMessage] = useState(invitation.message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const partySize = invitation.party_size ?? 1;
  const couple = `${invitation.partner_one ?? ""} & ${invitation.partner_two ?? ""}`.trim();

  const submit = async () => {
    if (!choice) {
      setError(t.common.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcError } = await supabase.rpc("submit_rsvp", {
        p_token: token,
        p_status: choice,
        p_num_attending: choice === "attending" ? numAttending : 0,
        p_dietary_notes: dietary.trim() || undefined,
        p_message: message.trim() || undefined,
      });
      if (rpcError) throw rpcError;
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="page">
        <div className="card confirmation">
          <div className="icon">{choice === "attending" ? "🎉" : "💌"}</div>
          <h1>{t.rsvp.submit}</h1>
          <p>
            {choice === "attending"
              ? t.rsvp.thanksAccept(couple)
              : t.rsvp.thanksDecline(couple)}
          </p>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <LanguageSwitcher compact />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <LanguageSwitcher compact />
        </div>
        <div className="brand">Union</div>
        <h1 className="couple">
          {invitation.partner_one} &amp; {invitation.partner_two}
        </h1>
        <p className="event-meta">
          {formatDate(invitation.event_date, locale)}
          {invitation.venue_name ? ` · ${invitation.venue_name}` : ""}
        </p>

        <p className="greeting">
          <strong>{invitation.guest_first_name}</strong> — {t.rsvp.joinPrompt(couple)}
        </p>

        <div className="field">
          <div className="choice-row">
            <button
              type="button"
              className={`choice ${choice === "attending" ? "selected-yes" : ""}`}
              onClick={() => setChoice("attending")}
            >
              {t.rsvp.accept}
            </button>
            <button
              type="button"
              className={`choice ${choice === "declined" ? "selected-no" : ""}`}
              onClick={() => setChoice("declined")}
            >
              {t.rsvp.decline}
            </button>
          </div>
        </div>

        {choice === "attending" && partySize > 1 ? (
          <div className="field">
            <label htmlFor="num">{t.rsvp.numAttendingLabel}</label>
            <select
              id="num"
              value={numAttending}
              onChange={(e) => setNumAttending(Number(e.target.value))}
            >
              {Array.from({ length: partySize }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {choice === "attending" ? (
          <div className="field">
            <label htmlFor="dietary">{t.rsvp.dietaryLabel}</label>
            <input
              id="dietary"
              type="text"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder={t.rsvp.dietaryPlaceholder}
            />
          </div>
        ) : null}

        {choice ? (
          <div className="field">
            <label htmlFor="message">{t.rsvp.messageLabel}</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.rsvp.messagePlaceholder}
            />
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <button className="btn" onClick={submit} disabled={busy}>
          {busy
            ? t.rsvp.submitting
            : alreadyResponded
              ? t.rsvp.update
              : t.rsvp.submit}
        </button>
      </div>
    </main>
  );
}
