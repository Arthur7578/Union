"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  LAST_EMAIL_KEY,
  sendEmailOtp,
  verifyEmailOtp,
} from "@/lib/auth";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { getSupabase } from "@/lib/supabase";
import type { JoinWeddingPreview } from "./page";

type View =
  | "checking"
  | "email_form"
  | "email_code"
  | "matches"
  | "no_match"
  | "name_form"
  | "name_confirm"
  | "name_contact"
  | "name_not_found"
  | "redirecting";

interface GuestAccessOption {
  guest_id: string;
  first_name: string;
  last_name: string | null;
  wedding_partner_one: string | null;
  wedding_partner_two: string | null;
  wedding_event_date: string | null;
  already_linked: boolean;
}

interface GuestAccessOptionsResult {
  status: "ok" | "not_authenticated";
  matches?: GuestAccessOption[];
}

interface ClaimGuestAccessResult {
  status:
    | "verified"
    | "not_authenticated"
    | "not_found"
    | "already_claimed"
    | "not_available";
  token?: string;
}

interface FindGuestByNameResult {
  status: "match" | "ambiguous" | "not_found" | "invalid_link";
  token?: string;
  first_name?: string;
  last_name?: string | null;
}

type NameMatch = {
  token: string;
  first_name: string;
  last_name: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  borderRadius: 12,
  border: "1px solid #d8d0c8",
  background: "#fff",
  color: "#2b2724",
  fontSize: 16,
  padding: "0 14px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: 0,
  borderRadius: 999,
  background: "#2b2724",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 20px",
};

const textButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#6f655f",
  fontSize: 14,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 4,
};

export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t, locale } = useLocale();
  const [view, setView] = useState<View>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [matches, setMatches] = useState<GuestAccessOption[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameContact, setNameContact] = useState("");
  const [nameMatch, setNameMatch] = useState<NameMatch | null>(null);

  const partners =
    [preview.partner_one, preview.partner_two].filter(Boolean).join(" & ") ||
    t.guests.theCouple;

  const dateLabel = preview.event_date
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${preview.event_date}T00:00:00Z`))
    : null;

  const redirectToGuest = useCallback((token: string) => {
    setView("redirecting");
    window.location.assign(`/guest/${token}`);
  }, []);

  const claimAndContinue = useCallback(
    async (guestId: string) => {
      setBusy(true);
      setError(null);
      try {
        const supabase = getBrowserSupabase();
        const { data, error: rpcError } = await supabase.rpc(
          "claim_guest_access",
          { p_guest_id: guestId },
        );
        if (rpcError) throw rpcError;

        const result = data as unknown as ClaimGuestAccessResult;
        if (result.status !== "verified" || !result.token) {
          throw new Error(t.joinOtp.accessUnavailable);
        }
        redirectToGuest(result.token);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : t.joinOtp.genericError,
        );
        setBusy(false);
      }
    },
    [redirectToGuest, t],
  );

  const loadGuestOptions = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const { data, error: rpcError } = await supabase.rpc(
      "get_guest_access_options",
      { p_join_code: code },
    );
    if (rpcError) throw rpcError;

    const result = data as unknown as GuestAccessOptionsResult;
    const found = result.matches ?? [];
    if (result.status !== "ok" || found.length === 0) {
      setView("no_match");
      return;
    }
    if (found.length === 1) {
      await claimAndContinue(found[0].guest_id);
      return;
    }
    setMatches(found);
    setView("matches");
  }, [claimAndContinue, code]);

  useEffect(() => {
    let active = true;

    try {
      const lastEmail = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (lastEmail) setEmail(lastEmail);
    } catch {
      // Prefill is optional.
    }

    void getBrowserSupabase()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!active) return;
        if (!data.session) {
          setView("email_form");
          return;
        }
        try {
          await loadGuestOptions();
        } catch {
          if (active) setView("email_form");
        }
      });

    return () => {
      active = false;
    };
  }, [loadGuestOptions]);

  const requestEmailCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendEmailOtp(email);
      setOtp("");
      setView("email_code");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t.joinOtp.genericError,
      );
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    void requestEmailCode();
  };

  const submitOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otp.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, otp);
      await loadGuestOptions();
    } catch {
      setError(t.joinOtp.invalidOrExpired);
    } finally {
      setBusy(false);
    }
  };

  const resetEmail = () => {
    setOtp("");
    setMatches([]);
    setError(null);
    setView("email_form");
  };

  const submitName = async (
    event: React.FormEvent,
    contact?: string,
  ) => {
    event.preventDefault();
    if (!firstName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "find_guest_by_name",
        {
          p_join_code: code,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim() || undefined,
          p_contact: contact?.trim() || undefined,
        },
      );
      if (rpcError) throw rpcError;

      const result = data as unknown as FindGuestByNameResult;
      if (result.status === "match" && result.token && result.first_name) {
        setNameMatch({
          token: result.token,
          first_name: result.first_name,
          last_name: result.last_name ?? null,
        });
        setView("name_confirm");
      } else if (result.status === "ambiguous" && !contact) {
        setView("name_contact");
      } else {
        setView("name_not_found");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t.join.errorGeneric,
      );
    } finally {
      setBusy(false);
    }
  };

  const resetName = () => {
    setFirstName("");
    setLastName("");
    setNameContact("");
    setNameMatch(null);
    setError(null);
    setView("name_form");
  };

  const renderContent = () => {
    if (view === "checking" || view === "redirecting") {
      return (
        <div style={{ textAlign: "center", color: "#756b65", padding: "28px 0" }}>
          {view === "checking"
            ? t.joinOtp.checkingSession
            : t.join.redirecting}
        </div>
      );
    }

    if (view === "email_form") {
      return (
        <>
          <h2 style={titleStyle}>{t.joinOtp.title}</h2>
          <p style={bodyStyle}>{t.joinOtp.subtitle}</p>
          <form onSubmit={submitEmail} style={{ display: "grid", gap: 16 }}>
            <FieldLabel label={t.joinOtp.emailLabel}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.joinOtp.emailPlaceholder}
                required
                style={inputStyle}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.joinOtp.searching : t.joinOtp.sendCodeButton}
            </button>
          </form>
          <p style={securityStyle}>{t.joinOtp.securityNote}</p>
          {preview.allow_name_fallback && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView("name_form");
              }}
              style={textButtonStyle}
            >
              {t.joinOtp.useNameFallback}
            </button>
          )}
        </>
      );
    }

    if (view === "email_code") {
      return (
        <>
          <h2 style={titleStyle}>{t.joinOtp.emailCollectTitle}</h2>
          <p style={bodyStyle}>{t.joinOtp.codeSentTo(email)}</p>
          <form onSubmit={submitOtp} style={{ display: "grid", gap: 16 }}>
            <FieldLabel label={t.joinOtp.codeLabel}>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder={t.joinOtp.codePlaceholder}
                required
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  letterSpacing: "0.25em",
                  fontSize: 20,
                }}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.joinOtp.verifying : t.joinOtp.verifyButton}
            </button>
          </form>
          <div style={linkRowStyle}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestEmailCode()}
              style={textButtonStyle}
            >
              {t.joinOtp.resendButton}
            </button>
            <button type="button" onClick={resetEmail} style={textButtonStyle}>
              {t.joinOtp.useAnotherEmail}
            </button>
          </div>
        </>
      );
    }

    if (view === "matches") {
      return (
        <>
          <h2 style={titleStyle}>{t.joinOtp.matchesTitle}</h2>
          <p style={bodyStyle}>{t.joinOtp.matchesSubtitle}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {matches.map((match) => {
              const couple =
                [match.wedding_partner_one, match.wedding_partner_two]
                  .filter(Boolean)
                  .join(" & ") || partners;
              return (
                <button
                  key={match.guest_id}
                  type="button"
                  disabled={busy}
                  onClick={() => void claimAndContinue(match.guest_id)}
                  style={{ ...primaryButtonStyle, minHeight: 56 }}
                >
                  {t.joinOtp.matchLine(couple, match.first_name)}
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (view === "no_match") {
      return (
        <>
          <h2 style={titleStyle}>{t.joinOtp.noMatchTitle}</h2>
          <p style={bodyStyle}>{t.joinOtp.noMatchBody(partners)}</p>
          <button type="button" onClick={resetEmail} style={primaryButtonStyle}>
            {t.joinOtp.useAnotherEmail}
          </button>
          {preview.allow_name_fallback && (
            <button
              type="button"
              onClick={() => setView("name_form")}
              style={textButtonStyle}
            >
              {t.joinOtp.useNameFallback}
            </button>
          )}
        </>
      );
    }

    if (view === "name_form") {
      return (
        <>
          <h2 style={titleStyle}>{t.join.namePromptTitle}</h2>
          <p style={bodyStyle}>{t.join.namePromptSubtitle}</p>
          <form
            onSubmit={(event) => void submitName(event)}
            style={{ display: "grid", gap: 14 }}
          >
            <FieldLabel label={t.join.firstNameLabel}>
              <input
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                style={inputStyle}
              />
            </FieldLabel>
            <FieldLabel label={t.join.lastNameLabel}>
              <input
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                style={inputStyle}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.join.searching : t.join.continueButton}
            </button>
          </form>
          <button type="button" onClick={resetEmail} style={textButtonStyle}>
            {t.joinOtp.backButton}
          </button>
        </>
      );
    }

    if (view === "name_contact") {
      return (
        <>
          <h2 style={titleStyle}>{t.join.contactTitle}</h2>
          <p style={bodyStyle}>{t.join.contactSubtitle}</p>
          <form
            onSubmit={(event) => void submitName(event, nameContact)}
            style={{ display: "grid", gap: 16 }}
          >
            <FieldLabel label={t.join.contactLabel}>
              <input
                value={nameContact}
                onChange={(event) => setNameContact(event.target.value)}
                placeholder={t.join.contactPlaceholder}
                required
                style={inputStyle}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.join.searching : t.join.contactSubmit}
            </button>
          </form>
        </>
      );
    }

    if (view === "name_confirm" && nameMatch) {
      const fullName = [nameMatch.first_name, nameMatch.last_name]
        .filter(Boolean)
        .join(" ");
      return (
        <>
          <h2 style={titleStyle}>{t.join.confirmTitle}</h2>
          <p
            style={{
              ...bodyStyle,
              color: "#2b2724",
              fontFamily: "var(--font-serif)",
              fontSize: 27,
            }}
          >
            {fullName}
          </p>
          <button
            type="button"
            onClick={() => redirectToGuest(nameMatch.token)}
            style={primaryButtonStyle}
          >
            {t.join.yesButton}
          </button>
          <button type="button" onClick={resetName} style={textButtonStyle}>
            {t.join.noButton}
          </button>
        </>
      );
    }

    return (
      <>
        <h2 style={titleStyle}>{t.join.notFoundTitle}</h2>
        <p style={bodyStyle}>{t.join.notFoundBody(partners)}</p>
        <button type="button" onClick={resetName} style={primaryButtonStyle}>
          {t.join.tryAgainButton}
        </button>
      </>
    );
  };

  return (
    <main style={pageStyle}>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LanguageSwitcher />
      </div>
      <section style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={kickerStyle}>{t.join.heroKicker}</div>
          <h1 style={heroStyle}>{partners}</h1>
          {(dateLabel || preview.venue_name) && (
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              {[dateLabel, preview.venue_name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div style={{ borderTop: "1px solid #eee8e1", paddingTop: 28 }}>
          {error && <div style={errorStyle}>{error}</div>}
          {renderContent()}
        </div>
      </section>
    </main>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 7, textAlign: "left" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#4f4742" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f1ea",
  padding: "80px 20px 32px",
  color: "#2b2724",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 18px 55px rgba(43, 39, 36, 0.08)",
  padding: "38px 32px",
  boxSizing: "border-box",
};

const kickerStyle: React.CSSProperties = {
  color: "#9a7d66",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const heroStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 38,
  lineHeight: 1.05,
  margin: "0 0 12px",
  fontWeight: 600,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 29,
  lineHeight: 1.15,
  margin: "0 0 10px",
  fontWeight: 600,
  textAlign: "center",
};

const bodyStyle: React.CSSProperties = {
  color: "#756b65",
  fontSize: 15,
  lineHeight: 1.55,
  textAlign: "center",
  margin: "0 0 22px",
};

const securityStyle: React.CSSProperties = {
  color: "#968b84",
  fontSize: 12,
  lineHeight: 1.45,
  textAlign: "center",
  margin: "14px 0 6px",
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 12,
};

const errorStyle: React.CSSProperties = {
  background: "#fff1ed",
  border: "1px solid #f0c6b9",
  color: "#8c3f2f",
  padding: "11px 13px",
  borderRadius: 10,
  fontSize: 13,
  marginBottom: 18,
};
