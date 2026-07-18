"use client";

import { useState } from "react";
import type { Database } from "@union/shared";
import { getSupabase } from "@/lib/supabase";

type Invitation =
  Database["public"]["Functions"]["get_invitation"]["Returns"][number];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
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

  const submit = async () => {
    if (!choice) {
      setError("Please let us know if you can make it.");
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
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="page">
        <div className="card confirmation">
          <div className="icon">{choice === "attending" ? "🎉" : "💌"}</div>
          <h1>Thank you!</h1>
          <p>
            {choice === "attending"
              ? "Your RSVP is confirmed. We can't wait to celebrate with you."
              : "Your response has been recorded. You'll be missed!"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        <div className="brand">You&apos;re invited</div>
        <h1 className="couple">
          {invitation.partner_one} &amp; {invitation.partner_two}
        </h1>
        <p className="event-meta">
          {formatDate(invitation.event_date)}
          {invitation.venue_name ? ` · ${invitation.venue_name}` : ""}
        </p>

        <p className="greeting">
          Hello <strong>{invitation.guest_first_name}</strong>, will you be
          joining us?
        </p>

        <div className="field">
          <div className="choice-row">
            <button
              type="button"
              className={`choice ${choice === "attending" ? "selected-yes" : ""}`}
              onClick={() => setChoice("attending")}
            >
              Joyfully accept
            </button>
            <button
              type="button"
              className={`choice ${choice === "declined" ? "selected-no" : ""}`}
              onClick={() => setChoice("declined")}
            >
              Regretfully decline
            </button>
          </div>
        </div>

        {choice === "attending" && partySize > 1 ? (
          <div className="field">
            <label htmlFor="num">Number attending</label>
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
            <label htmlFor="dietary">Dietary notes (optional)</label>
            <input
              id="dietary"
              type="text"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Allergies, vegetarian, etc."
            />
          </div>
        ) : null}

        {choice ? (
          <div className="field">
            <label htmlFor="message">A note for the couple (optional)</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something sweet…"
            />
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? "Sending…" : alreadyResponded ? "Update my response" : "Send RSVP"}
        </button>
      </div>
    </main>
  );
}
