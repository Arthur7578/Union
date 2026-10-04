"use client";

import { GuestWelcome } from "@/components/guest/GuestWelcome";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { guestLinkPath } from "@union/shared";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CountrySelect, useBrowserCountry } from "@/components/PhoneField";
import { LAST_EMAIL_KEY, sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { writeActiveGuestIdentity } from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useTurnstile } from "@/lib/turnstile";
import type { JoinWeddingPreview } from "./page";
import { G, T, alpha } from "@/lib/theme";
import { isPhoneCountry, toStoredPhone, type PhoneCountry } from "@union/shared";

type View =
  | "checking"
  | "contact_form"
  | "first_name"
  | "email_code"
  | "no_match"
  | "redirecting";

type DisambiguationSource = "contact" | "authenticated" | null;

interface ContactLookupResult {
  status:
    | "match"
    | "ambiguous"
    | "otp_required"
    | "email_required"
    | "not_found"
    | "invalid_link";
  token?: string;
}

interface GuestAccessOption {
  guest_id: string;
  first_name: string;
  last_name: string | null;
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

function readLastEmail(): string {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const otpMode = preview.guest_join_auth_mode === "otp";
  const [view, setView] = useState<View>("checking");
  // The faire-part welcome greets a group-link visitor once, before identification.
  const [welcomed, setWelcomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState(() => (otpMode ? readLastEmail() : ""));
  const [email, setEmail] = useState(() => (otpMode ? readLastEmail() : ""));
  // The country of a phone number typed without "+"; see phoneMode below.
  // Until the guest chooses, the browser's country is shown for them to
  // confirm or change.
  const browserCountry = useBrowserCountry();
  const [pickedCountry, setPickedCountry] = useState<
    PhoneCountry | null | undefined
  >(undefined);
  const contactCountry =
    pickedCountry !== undefined ? pickedCountry : browserCountry;
  const [firstName, setFirstName] = useState("");
  const [otp, setOtp] = useState("");
  const [disambiguationSource, setDisambiguationSource] =
    useState<DisambiguationSource>(null);
  const { captcha, getCaptchaToken } = useTurnstile();

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

  const redirectToGuest = useCallback(
    (token: string) => {
      setView("redirecting");
      router.push(guestLinkPath(token));
    },
    [router],
  );

  const claimAndContinue = useCallback(
    async (match: GuestAccessOption) => {
      setBusy(true);
      setError(null);
      try {
        const supabase = getBrowserSupabase();
        const { data, error: rpcError } = await supabase.rpc(
          "claim_guest_access",
          { p_guest_id: match.guest_id },
        );
        if (rpcError) throw rpcError;

        const result = data as unknown as ClaimGuestAccessResult;
        if (result.status !== "verified" || !result.token) {
          throw new Error(t.guestJoin.accessUnavailable);
        }

        const { data: authData } = await supabase.auth.getSession();
        if (authData.session) {
          writeActiveGuestIdentity({
            userId: authData.session.user.id,
            guestId: match.guest_id,
            guestName: [match.first_name, match.last_name]
              .filter(Boolean)
              .join(" "),
          });
        }
        redirectToGuest(result.token);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : t.guestJoin.genericError,
        );
        setBusy(false);
      }
    },
    [redirectToGuest, t],
  );

  const loadAuthenticatedOptions = useCallback(
    async (name?: string) => {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "get_guest_access_options",
        {
          p_join_code: code,
          p_first_name: name?.trim() || null,
        },
      );
      if (rpcError) throw rpcError;

      const result = data as unknown as GuestAccessOptionsResult;
      const found = result.matches ?? [];
      if (result.status !== "ok" || found.length === 0) {
        setView("no_match");
        return;
      }
      if (found.length > 1) {
        if (name) {
          setView("no_match");
        } else {
          setDisambiguationSource("authenticated");
          setView("first_name");
        }
        return;
      }
      await claimAndContinue(found[0]);
    },
    [claimAndContinue, code],
  );

  useEffect(() => {
    let active = true;

    void getBrowserSupabase()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!active) return;
        if (!data.session) {
          setView("contact_form");
          return;
        }
        try {
          await loadAuthenticatedOptions();
        } catch {
          if (active) setView("contact_form");
        }
      });

    return () => {
      active = false;
    };
  }, [loadAuthenticatedOptions, otpMode]);

  const requestEmailCode = async (address = email) => {
    const cleanEmail = address.trim();
    if (!cleanEmail) return;
    setBusy(true);
    setError(null);
    try {
      setEmail(cleanEmail);
      await sendEmailOtp(cleanEmail, await getCaptchaToken());
      setOtp("");
      setView("email_code");
    } catch {
      setError(t.guestJoin.sendCodeError);
    } finally {
      setBusy(false);
    }
  };

  // The guest types an email or a phone in one field. A number only means
  // something with its country, so while they are typing one without a "+"
  // (or 00) we ask for it, and the lookup always sends a number that states
  // its country (E.164). Pre-selecting the browser's country only gives them
  // something visible to confirm.
  const looksLikePhone =
    !otpMode && /\d/.test(contact) && !contact.includes("@");
  const phoneMode = looksLikePhone && !/^\s*(\+|00)/.test(contact);

  const resolveContact = async (name?: string) => {
    const cleanContact = contact.trim();
    if (!cleanContact) return;
    if (phoneMode && !contactCountry) {
      setError(t.common.phoneCountryMissing);
      return;
    }
    const lookup = looksLikePhone
      ? toStoredPhone(contactCountry, cleanContact)
      : cleanContact;
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "find_guest_by_contact",
        {
          p_join_code: code,
          p_contact: lookup,
          p_first_name: name?.trim() || null,
        },
      );
      if (rpcError) throw rpcError;

      const result = data as unknown as ContactLookupResult;
      if (result.status === "match" && result.token) {
        redirectToGuest(result.token);
        return;
      }
      if (result.status === "ambiguous" && !name) {
        setDisambiguationSource("contact");
        setView("first_name");
        return;
      }
      if (result.status === "otp_required") {
        await requestEmailCode(cleanContact);
        return;
      }
      if (result.status === "email_required") {
        setError(t.guestJoin.emailRequired);
        setView("contact_form");
        return;
      }
      setView("no_match");
    } catch {
      setError(t.guestJoin.genericError);
    } finally {
      setBusy(false);
    }
  };

  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();
    void resolveContact();
  };

  const submitFirstName = (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) return;
    if (disambiguationSource === "authenticated") {
      setBusy(true);
      setError(null);
      void loadAuthenticatedOptions(firstName)
        .catch(() => setError(t.guestJoin.genericError))
        .finally(() => setBusy(false));
    } else {
      void resolveContact(firstName);
    }
  };

  const submitOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otp.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, otp);
      await loadAuthenticatedOptions(firstName || undefined);
    } catch {
      setError(t.guestJoin.invalidCode);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setFirstName("");
    setOtp("");
    setEmail("");
    setDisambiguationSource(null);
    setError(null);
    setView("contact_form");
  };

  const renderContent = () => {
    if (view === "checking" || view === "redirecting") {
      return (
        <div style={{ textAlign: "center", color: G.muted2, padding: "28px 0" }}>
          {view === "checking"
            ? t.guestJoin.checkingSession
            : t.guestJoin.redirecting}
        </div>
      );
    }

    if (view === "contact_form") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.title}</h2>
          <p style={bodyStyle}>
            {otpMode
              ? t.guestJoin.otpSubtitle
              : t.guestJoin.contactSubtitle}
          </p>
          <form onSubmit={submitContact} style={{ display: "grid", gap: 16 }}>
            <FieldLabel
              label={
                otpMode
                  ? t.guestJoin.emailLabel
                  : t.guestJoin.contactLabel
              }
            >
              <input
                type={otpMode ? "email" : "text"}
                autoComplete={otpMode ? "email" : "username"}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder={
                  otpMode
                    ? t.guestJoin.emailPlaceholder
                    : t.guestJoin.contactPlaceholder
                }
                required
                style={inputStyle}
              />
            </FieldLabel>
            {phoneMode && (
              <CountrySelect
                value={contactCountry}
                onChange={(code) =>
                  setPickedCountry(isPhoneCountry(code) ? code : null)
                }
                style={inputStyle}
              />
            )}
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.guestJoin.searching : t.guestJoin.continueButton}
            </button>
          </form>
          <p style={securityStyle}>
            {otpMode
              ? t.guestJoin.otpSecurityNote
              : t.guestJoin.contactSecurityNote}
          </p>
        </>
      );
    }

    if (view === "first_name") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.firstNameTitle}</h2>
          <p style={bodyStyle}>{t.guestJoin.firstNameSubtitle}</p>
          <form onSubmit={submitFirstName} style={{ display: "grid", gap: 16 }}>
            <FieldLabel label={t.guestJoin.firstNameLabel}>
              <input
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                style={inputStyle}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.guestJoin.searching : t.guestJoin.continueButton}
            </button>
          </form>
          <button type="button" onClick={startOver} style={textButtonStyle}>
            {t.guestJoin.useAnotherContact}
          </button>
        </>
      );
    }

    if (view === "email_code") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.codeTitle}</h2>
          <p style={bodyStyle}>{t.guestJoin.codeSent(email)}</p>
          <form onSubmit={submitOtp} style={{ display: "grid", gap: 16 }}>
            <FieldLabel label={t.guestJoin.codeLabel}>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder={t.guestJoin.codePlaceholder}
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
              {busy ? t.guestJoin.verifying : t.guestJoin.verifyButton}
            </button>
          </form>
          <div style={linkRowStyle}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestEmailCode()}
              style={textButtonStyle}
            >
              {t.guestJoin.resendButton}
            </button>
            <button type="button" onClick={startOver} style={textButtonStyle}>
              {t.guestJoin.useAnotherContact}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <h2 style={titleStyle}>{t.guestJoin.noMatchTitle}</h2>
        <p style={bodyStyle}>{t.guestJoin.noMatchBody(partners)}</p>
        <button type="button" onClick={startOver} style={primaryButtonStyle}>
          {t.guestJoin.tryAgainButton}
        </button>
      </>
    );
  };

  if (view === "contact_form" && !welcomed) {
    return (
      <GuestWelcome
        partnerOne={preview.partner_one}
        partnerTwo={preview.partner_two}
        eventDate={preview.event_date}
        venueName={preview.venue_name}
        locale={locale}
        onRespond={() => setWelcomed(true)}
      />
    );
  }

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
        <div style={{ borderTop: `1px solid ${T.sandBg}`, paddingTop: 28 }}>
          {error && <div style={errorStyle}>{error}</div>}
          {renderContent()}
          {/* Every view that can send a code (first send, resend) shares this
              one mount point; it stays empty unless a challenge needs a click. */}
          {captcha}
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
      <span style={{ fontSize: 13, fontWeight: 600, color: G.ink2 }}>
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
  background: G.bg,
  padding: "80px 20px 32px",
  color: G.ink,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  borderRadius: 24,
  background: T.white,
  boxShadow: `0 18px 55px ${alpha(G.ink, 0.08)}`,
  padding: "38px 32px",
  boxSizing: "border-box",
};

const kickerStyle: React.CSSProperties = {
  color: G.gold,
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
  color: G.muted2,
  fontSize: 15,
  lineHeight: 1.55,
  textAlign: "center",
  margin: "0 0 22px",
};

const securityStyle: React.CSSProperties = {
  color: G.faint,
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  borderRadius: 12,
  border: `1px solid ${G.borderInput}`,
  background: T.white,
  color: G.ink,
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
  background: G.ink,
  color: T.white,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 20px",
};

const textButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: G.muted3,
  fontSize: 14,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 4,
};

const errorStyle: React.CSSProperties = {
  background: G.errBg,
  border: `1px solid ${G.errBorder}`,
  color: G.errInk,
  padding: "11px 13px",
  borderRadius: 10,
  fontSize: 13,
  marginBottom: 18,
};
