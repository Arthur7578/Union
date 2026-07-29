"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Invitation } from "@union/shared";
import { getSupabase } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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

type Choice = "attending" | "declined" | null;
type CompanionState = {
  id: string;
  first_name: string;
  last_name: string | null;
  kind: "adult" | "child";
  relationship: "partner_of" | "parent_of";
  choice: Choice;
  dietary: string;
};

export function RsvpForm({
  token,
  invitation,
}: {
  token: string;
  invitation: Invitation;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();

  const alreadyResponded = invitation.guest.rsvp_status !== "pending";
  const [choice, setChoice] = useState<Choice>(
    alreadyResponded ? (invitation.guest.rsvp_status as "attending" | "declined") : null,
  );
  const [dietary, setDietary] = useState(invitation.guest.dietary_notes ?? "");
  const [message, setMessage] = useState(invitation.guest.message ?? "");

  const [companions, setCompanions] = useState<CompanionState[]>(
    invitation.companions.map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      kind: c.kind,
      relationship: c.relationship,
      choice:
        c.rsvp_status === "pending"
          ? null
          : (c.rsvp_status as "attending" | "declined"),
      dietary: c.dietary_notes ?? "",
    })),
  );

  const [addKind, setAddKind] = useState<"partner" | "child" | null>(null);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [showMergePrompt, setShowMergePrompt] = useState(
    invitation.self_merge_candidates.length > 0,
  );
  const [mergeBusy, setMergeBusy] = useState(false);

  const couple =
    `${invitation.wedding.partner_one ?? ""} & ${invitation.wedding.partner_two ?? ""}`.trim();
  const perms = invitation.permissions;

  const setCompanion = (id: string, patch: Partial<CompanionState>) =>
    setCompanions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

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
        p_dietary_notes: dietary.trim() || undefined,
        p_message: message.trim() || undefined,
      });
      if (rpcError) throw rpcError;

      for (const c of companions) {
        if (!c.choice) continue;
        const res = await supabase.rpc("submit_companion_rsvp", {
          p_token: token,
          p_companion_guest_id: c.id,
          p_status: c.choice,
          p_dietary_notes: c.dietary.trim() || undefined,
        });
        if (res.error) throw res.error;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const registerCompanion = async (forceCreate: boolean) => {
    if (!addKind) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("rsvp_register_companion", {
        p_token: token,
        p_kind: addKind,
        p_first_name: addFirst.trim(),
        p_last_name: addLast.trim() || undefined,
        p_resolve: forceCreate ? "force_create" : "auto",
      });
      if (rpcError) throw rpcError;
      const payload = (data ?? {}) as {
        status?: string;
        guest_id?: string;
        candidates?: Array<{ id: string; first_name: string; last_name: string | null; kind: string; added_by_first_name: string | null }>;
      };
      if (payload.status === "candidates" && payload.candidates?.length) {
        setAddError(
          `${payload.candidates[0].first_name} was already added${
            payload.candidates[0].added_by_first_name
              ? ` by ${payload.candidates[0].added_by_first_name}`
              : ""
          }. Add anyway?`,
        );
        return;
      }
      if (payload.status === "created" && payload.guest_id) {
        setCompanions((prev) => [
          ...prev,
          {
            id: payload.guest_id!,
            first_name: addFirst.trim(),
            last_name: addLast.trim() || null,
            kind: addKind === "child" ? "child" : "adult",
            relationship: addKind === "child" ? "parent_of" : "partner_of",
            choice: "attending",
            dietary: "",
          },
        ]);
        setAddKind(null);
        setAddFirst("");
        setAddLast("");
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setAddBusy(false);
    }
  };

  const confirmSelfMerge = async (targetId: string) => {
    setMergeBusy(true);
    try {
      const supabase = getSupabase();
      const { error: rpcError } = await supabase.rpc("rsvp_merge_into", {
        p_token: token,
        p_target_guest_id: targetId,
      });
      if (rpcError) throw rpcError;
      // Reload with merged state.
      router.refresh();
      setShowMergePrompt(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setMergeBusy(false);
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
          {invitation.wedding.partner_one} &amp; {invitation.wedding.partner_two}
        </h1>
        <p className="event-meta">
          {formatDate(invitation.wedding.event_date, locale)}
          {invitation.wedding.venue_name ? ` · ${invitation.wedding.venue_name}` : ""}
        </p>

        {showMergePrompt && (
          <div
            style={{
              margin: "12px 0 20px",
              padding: 14,
              borderRadius: 12,
              background: "rgba(224,204,177,.35)",
              border: "1px solid rgba(67,53,58,.12)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Looks like someone already added you.
            </div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              We found {invitation.self_merge_candidates.length === 1 ? "a" : "some"}{" "}
              matching guest{invitation.self_merge_candidates.length === 1 ? "" : "s"}.
              Which one is you?
            </div>
            {invitation.self_merge_candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => confirmSelfMerge(c.id)}
                disabled={mergeBusy}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid rgba(67,53,58,.15)",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <b>{c.first_name} {c.last_name ?? ""}</b>
                {c.added_by_first_name ? ` — added by ${c.added_by_first_name}` : ""}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowMergePrompt(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#8a7f80",
                textDecoration: "underline",
                fontSize: 12,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              None of those — this is me
            </button>
          </div>
        )}

        <p className="greeting">
          <strong>{invitation.guest.first_name}</strong> — {t.rsvp.joinPrompt(couple)}
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

        {companions.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(67,53,58,.1)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              Who's coming with you?
            </div>
            {companions.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 12,
                  marginBottom: 10,
                  border: "1px solid rgba(67,53,58,.1)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  {c.first_name} {c.last_name ?? ""}{" "}
                  <span style={{ fontWeight: 400, color: "#8a7f80", fontSize: 12 }}>
                    · {c.relationship === "partner_of" ? "partner" : c.kind === "child" ? "child" : "guest"}
                  </span>
                </div>
                <div className="choice-row">
                  <button
                    type="button"
                    className={`choice ${c.choice === "attending" ? "selected-yes" : ""}`}
                    onClick={() => setCompanion(c.id, { choice: "attending" })}
                  >
                    {t.rsvp.accept}
                  </button>
                  <button
                    type="button"
                    className={`choice ${c.choice === "declined" ? "selected-no" : ""}`}
                    onClick={() => setCompanion(c.id, { choice: "declined" })}
                  >
                    {t.rsvp.decline}
                  </button>
                </div>
                {c.choice === "attending" && (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor={`d-${c.id}`}>{t.rsvp.dietaryLabel}</label>
                    <input
                      id={`d-${c.id}`}
                      type="text"
                      value={c.dietary}
                      onChange={(e) => setCompanion(c.id, { dietary: e.target.value })}
                      placeholder={t.rsvp.dietaryPlaceholder}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(perms.can_add_partner || (perms.can_add_kids && (perms.kids_remaining ?? 1) > 0)) && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(67,53,58,.1)" }}>
            {addKind === null ? (
              <div style={{ display: "flex", gap: 8 }}>
                {perms.can_add_partner && (
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1, background: "#fff", color: "#43353a", border: "1px solid rgba(67,53,58,.2)" }}
                    onClick={() => {
                      setAddKind("partner");
                      setAddError(null);
                    }}
                  >
                    + Add my partner
                  </button>
                )}
                {perms.can_add_kids && (perms.kids_remaining ?? 1) > 0 && (
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1, background: "#fff", color: "#43353a", border: "1px solid rgba(67,53,58,.2)" }}
                    onClick={() => {
                      setAddKind("child");
                      setAddError(null);
                    }}
                  >
                    + Add a child
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: 12, border: "1px solid rgba(67,53,58,.1)", borderRadius: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                  {addKind === "partner" ? "Add your partner" : "Add a child"}
                </div>
                <div className="field">
                  <label htmlFor="af">First name</label>
                  <input
                    id="af"
                    type="text"
                    value={addFirst}
                    onChange={(e) => setAddFirst(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="al">Last name (optional)</label>
                  <input
                    id="al"
                    type="text"
                    value={addLast}
                    onChange={(e) => setAddLast(e.target.value)}
                  />
                </div>
                {addError && (
                  <div style={{ fontSize: 13, color: "#C0553B", marginBottom: 8 }}>
                    {addError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => registerCompanion(!!addError)}
                    disabled={addBusy || !addFirst.trim()}
                    style={{ flex: 1 }}
                  >
                    {addBusy ? "…" : addError ? "Add anyway" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setAddKind(null);
                      setAddError(null);
                      setAddFirst("");
                      setAddLast("");
                    }}
                    style={{ background: "#fff", color: "#43353a", border: "1px solid rgba(67,53,58,.2)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error ? <p className="error">{error}</p> : null}

        <button className="btn" onClick={submit} disabled={busy} style={{ marginTop: 20 }}>
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
