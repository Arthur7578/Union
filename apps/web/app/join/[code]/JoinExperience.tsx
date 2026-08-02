"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupabase } from "@/lib/supabase";
import type { JoinWeddingPreview } from "./page";

type View =
  | "phone_form"
  | "phone_collect_email"
  | "phone_code"
  | "phone_not_found"
  | "email_form"
  | "email_code"
  | "email_matches"
  | "name_form"
  | "name_confirm"
  | "name_contact"
  | "name_not_found"
  | "verified"
  | "redirecting";

interface FindGuestByPhoneResult {
  status: "match" | "ambiguous" | "not_found" | "invalid_link";
  has_email?: boolean;
}

interface RequestOtpRouteResult {
  status: "sent" | "cooldown" | "too_many_requests" | "email_required" | "not_found";
  maskedEmail?: string;
}

interface VerifyGuestEmailOtpResult {
  status: "verified" | "invalid_or_expired";
  token?: string;
  first_name?: string;
  last_name?: string | null;
  has_organiser_account?: boolean;
}

interface OtpMatch {
  wedding_partner_one: string | null;
  wedding_partner_two: string | null;
  wedding_event_date: string | null;
  token: string;
  first_name: string;
  last_name: string | null;
}

interface VerifyGuestOtpResult {
  status: "verified" | "invalid_or_expired";
  matches?: OtpMatch[];
  has_organiser_account?: boolean;
}

// The existing name-only fallback (migration 0026), unchanged.
interface FindGuestByNameResult {
  status: "match" | "ambiguous" | "not_found" | "invalid_link";
  token?: string;
  first_name?: string;
  last_name?: string | null;
}
type NameMatch = { token: string; first_name: string; last_name: string | null };

export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t, locale } = useLocale();

  const [view, setView] = useState<View>("phone_form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Shared between the phone-bootstrap and name-fallback tiers.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Phone-bootstrap tier
  const [phone, setPhone] = useState("");
  const [collectEmailInput, setCollectEmailInput] = useState("");
  const [bootstrapEmail, setBootstrapEmail] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");

  // Direct-email tier
  const [directEmail, setDirectEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [matches, setMatches] = useState<OtpMatch[]>([]);

  // Name-only fallback tier (existing behaviour)
  const [nameContact, setNameContact] = useState("");
  const [nameMatch, setNameMatch] = useState<NameMatch | null>(null);

  // Post-verification interstitial (only shown when there's something to
  // say — a freshly-saved email, or a co-organiser overlap — otherwise we
  // redirect straight through).
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingCoupleLabel, setPendingCoupleLabel] = useState<string | null>(null);
  const [hasOrganiserAccount, setHasOrganiserAccount] = useState(false);
  const [savedEmailNotice, setSavedEmailNotice] = useState(false);

  const partners =
    [preview.partner_one, preview.partner_two].filter(Boolean).join(" & ") ||
    (locale === "fr" ? "les mariés" : "the couple");

  const displayDate = preview.event_date
    ? new Date(`${preview.event_date}T00:00:00`).toLocaleDateString(
        locale === "fr" ? "fr-FR" : "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
      )
    : null;

  const redirectToGuest = (token: string) => {
    setView("redirecting");
    window.location.href = `/guest/${token}`;
  };

  const finishVerification = (
    token: string,
    hasOrganiser: boolean,
    showSavedNotice: boolean,
    coupleLabel?: string | null,
  ) => {
    if (hasOrganiser || showSavedNotice) {
      setPendingToken(token);
      setHasOrganiserAccount(hasOrganiser);
      setSavedEmailNotice(showSavedNotice);
      setPendingCoupleLabel(coupleLabel ?? null);
      setView("verified");
    } else {
      redirectToGuest(token);
    }
  };

  // ---------------- Phone-bootstrap tier ----------------

  const submitPhoneForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("find_guest_by_phone", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim() || undefined,
        p_phone: phone.trim(),
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as FindGuestByPhoneResult;
      if (result.status === "match") {
        if (result.has_email) {
          await requestBootstrapOtp(undefined);
        } else {
          setView("phone_collect_email");
        }
      } else {
        setView("phone_not_found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.joinOtp.genericError);
    } finally {
      setBusy(false);
    }
  };

  const requestBootstrapOtp = async (emailOverride: string | undefined) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/guest-otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "bootstrap",
          joinCode: code,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim(),
          email: emailOverride,
        }),
      });
      const result = (await res.json()) as RequestOtpRouteResult;
      if (result.status === "sent") {
        if (emailOverride) setBootstrapEmail(emailOverride);
        setMaskedEmail(result.maskedEmail ?? null);
        setPhoneCode("");
        setView("phone_code");
      } else if (result.status === "email_required") {
        setView("phone_collect_email");
      } else if (result.status === "cooldown") {
        setNotice(t.joinOtp.cooldown);
      } else if (result.status === "too_many_requests") {
        setNotice(t.joinOtp.tooManyRequests);
      } else {
        setView("phone_not_found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.joinOtp.genericError);
    } finally {
      setBusy(false);
    }
  };

  const submitCollectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectEmailInput.trim()) return;
    await requestBootstrapOtp(collectEmailInput.trim());
  };

  const submitPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("verify_guest_email_otp", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim() || undefined,
        p_phone: phone.trim(),
        p_code: phoneCode.trim(),
        p_email: bootstrapEmail ?? undefined,
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as VerifyGuestEmailOtpResult;
      if (result.status === "verified" && result.token) {
        finishVerification(
          result.token,
          !!result.has_organiser_account,
          !!bootstrapEmail,
        );
      } else {
        setError(t.joinOtp.invalidOrExpired);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.joinOtp.genericError);
    } finally {
      setBusy(false);
    }
  };

  const startOverPhone = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setCollectEmailInput("");
    setBootstrapEmail(null);
    setMaskedEmail(null);
    setPhoneCode("");
    setError(null);
    setNotice(null);
    setView("phone_form");
  };

  // ---------------- Direct-email tier ----------------

  const switchToEmailTier = () => {
    setError(null);
    setNotice(null);
    setView("email_form");
  };

  const requestDirectOtp = async () => {
    if (!directEmail.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/guest-otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "direct", email: directEmail.trim() }),
      });
      const result = (await res.json()) as RequestOtpRouteResult;
      if (result.status === "cooldown") {
        setNotice(t.joinOtp.cooldown);
      } else if (result.status === "too_many_requests") {
        setNotice(t.joinOtp.tooManyRequests);
      } else {
        setEmailCode("");
        setView("email_code");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.joinOtp.genericError);
    } finally {
      setBusy(false);
    }
  };

  const submitEmailForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestDirectOtp();
  };

  const submitEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("verify_guest_otp", {
        p_email: directEmail.trim(),
        p_code: emailCode.trim(),
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as VerifyGuestOtpResult;
      if (result.status !== "verified") {
        setError(t.joinOtp.invalidOrExpired);
        return;
      }
      const found = result.matches ?? [];
      setHasOrganiserAccount(!!result.has_organiser_account);
      if (found.length === 1) {
        const m = found[0];
        const coupleLabel =
          [m.wedding_partner_one, m.wedding_partner_two].filter(Boolean).join(" & ") ||
          partners;
        finishVerification(m.token, !!result.has_organiser_account, false, coupleLabel);
      } else if (found.length > 1) {
        setMatches(found);
        setView("email_matches");
      } else {
        setError(t.joinOtp.genericError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.joinOtp.genericError);
    } finally {
      setBusy(false);
    }
  };

  const startOverEmail = () => {
    setDirectEmail("");
    setEmailCode("");
    setMatches([]);
    setError(null);
    setNotice(null);
    setView("phone_form");
  };

  // ---------------- Name-only fallback tier (existing 0026 flow) ----------------

  const switchToNameTier = () => {
    setError(null);
    setNotice(null);
    setView("name_form");
  };

  const submitNameForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("find_guest_by_name", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim() || undefined,
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as FindGuestByNameResult;
      if (result.status === "match") {
        setNameMatch({
          token: result.token!,
          first_name: result.first_name!,
          last_name: result.last_name ?? null,
        });
        setView("name_confirm");
      } else if (result.status === "ambiguous") {
        setView("name_contact");
      } else {
        setView("name_not_found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.join.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const submitNameContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameContact.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc("find_guest_by_name", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim() || undefined,
        p_contact: nameContact.trim(),
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as FindGuestByNameResult;
      if (result.status === "match") {
        setNameMatch({
          token: result.token!,
          first_name: result.first_name!,
          last_name: result.last_name ?? null,
        });
        setView("name_confirm");
      } else {
        setView("name_not_found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.join.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const confirmNameYes = () => {
    if (!nameMatch) return;
    redirectToGuest(nameMatch.token);
  };

  const startOverName = () => {
    setNameMatch(null);
    setNameContact("");
    setError(null);
    setView("name_form");
  };

  // ---------------- shared style helpers ----------------

  const cardStyle: React.CSSProperties = {
    maxWidth: 460,
    width: "100%",
    background: "white",
    padding: "40px 32px",
    borderRadius: 24,
    boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #e1dec3",
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 15,
    background: "#fbfbf8",
    color: "#2b2724",
    marginBottom: 14,
  };

  const codeFieldStyle: React.CSSProperties = {
    ...fieldStyle,
    letterSpacing: "0.35em",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: 16,
    background: "#43353a",
    color: "white",
    border: "none",
    borderRadius: 14,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: 16,
    background: "#fbfbf8",
    color: "#43353a",
    border: "1px solid #e1dec3",
    borderRadius: 14,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  };

  const linkButtonStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#8a817c",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  };

  const h2Style: React.CSSProperties = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 24,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 6,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 6,
  };

  const disabled = (ready: boolean) => busy || !ready;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f1ea",
        fontFamily: "'Instrument Sans', sans-serif",
        padding: 24,
        color: "#2b2724",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Instrument+Sans:wght@300;400;600;700&display=swap');`,
        }}
      />
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <LanguageSwitcher compact />
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#b07c82",
            fontWeight: 600,
          }}
        >
          {t.join.heroKicker}
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 44,
            fontWeight: 300,
            letterSpacing: -1,
            margin: "4px 0 8px",
          }}
        >
          {partners}
        </h1>
        {displayDate && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              color: "#8a817c",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {displayDate}
            {preview.venue_name ? ` • ${preview.venue_name}` : ""}
          </p>
        )}
      </div>

      <div style={cardStyle}>
        {/* ---------------- Phone-bootstrap tier ---------------- */}

        {view === "phone_form" && (
          <form onSubmit={submitPhoneForm}>
            <h2 style={h2Style}>{t.joinOtp.title}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.joinOtp.subtitle}
            </p>
            <label htmlFor="jf-first" style={labelStyle}>
              {t.join.firstNameLabel}
            </label>
            <input
              id="jf-first"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={fieldStyle}
            />
            <label htmlFor="jf-last" style={labelStyle}>
              {t.join.lastNameLabel}
            </label>
            <input
              id="jf-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={fieldStyle}
            />
            <label htmlFor="jf-phone" style={labelStyle}>
              {t.joinOtp.phoneLabel}
            </label>
            <input
              id="jf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.joinOtp.phonePlaceholder}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(!!firstName.trim() && !!phone.trim())}
              style={{
                ...buttonStyle,
                opacity: disabled(!!firstName.trim() && !!phone.trim()) ? 0.6 : 1,
                cursor: disabled(!!firstName.trim() && !!phone.trim())
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {busy ? t.joinOtp.searching : t.joinOtp.continueButton}
            </button>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 18,
                textAlign: "center",
              }}
            >
              <button type="button" onClick={switchToEmailTier} style={linkButtonStyle}>
                {t.joinOtp.useEmailInstead}
              </button>
              {preview.allow_name_fallback && (
                <button type="button" onClick={switchToNameTier} style={linkButtonStyle}>
                  {t.joinOtp.useNameFallback}
                </button>
              )}
            </div>
          </form>
        )}

        {view === "phone_collect_email" && (
          <form onSubmit={submitCollectEmail}>
            <h2 style={h2Style}>{t.joinOtp.emailCollectTitle}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.joinOtp.emailCollectSubtitle}
            </p>
            <label htmlFor="jf-collect-email" style={labelStyle}>
              {t.joinOtp.emailLabel}
            </label>
            <input
              id="jf-collect-email"
              autoFocus
              type="email"
              value={collectEmailInput}
              onChange={(e) => setCollectEmailInput(e.target.value)}
              placeholder={t.joinOtp.emailPlaceholder}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {notice && (
              <p style={{ color: "#b8860b", fontSize: 13, marginBottom: 14 }}>{notice}</p>
            )}
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(!!collectEmailInput.trim())}
              style={{
                ...buttonStyle,
                opacity: disabled(!!collectEmailInput.trim()) ? 0.6 : 1,
                cursor: disabled(!!collectEmailInput.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.joinOtp.searching : t.joinOtp.sendCodeButton}
            </button>
          </form>
        )}

        {view === "phone_code" && (
          <form onSubmit={submitPhoneCode}>
            <h2 style={h2Style}>{t.joinOtp.codeLabel}</h2>
            {maskedEmail && (
              <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
                {t.joinOtp.codeSentTo(maskedEmail)}
              </p>
            )}
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t.joinOtp.codePlaceholder}
              style={{ ...codeFieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(phoneCode.length === 6)}
              style={{
                ...buttonStyle,
                opacity: disabled(phoneCode.length === 6) ? 0.6 : 1,
                cursor: disabled(phoneCode.length === 6) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.joinOtp.verifying : t.joinOtp.verifyButton}
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 14,
              }}
            >
              <button type="button" onClick={startOverPhone} style={linkButtonStyle}>
                {t.joinOtp.startOverButton}
              </button>
              <button
                type="button"
                onClick={() => requestBootstrapOtp(bootstrapEmail ?? undefined)}
                disabled={busy}
                style={linkButtonStyle}
              >
                {t.joinOtp.resendButton}
              </button>
            </div>
          </form>
        )}

        {view === "phone_not_found" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
            <h2 style={h2Style}>{t.join.notFoundTitle}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {t.join.notFoundBody(partners)}
            </p>
            <button type="button" onClick={startOverPhone} style={buttonStyle}>
              {t.join.tryAgainButton}
            </button>
          </div>
        )}

        {/* ---------------- Direct-email tier ---------------- */}

        {view === "email_form" && (
          <form onSubmit={submitEmailForm}>
            <h2 style={h2Style}>{t.joinOtp.emailCollectTitle}</h2>
            <label htmlFor="jf-direct-email" style={labelStyle}>
              {t.joinOtp.emailLabel}
            </label>
            <input
              id="jf-direct-email"
              autoFocus
              type="email"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              placeholder={t.joinOtp.emailPlaceholder}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {notice && (
              <p style={{ color: "#b8860b", fontSize: 13, marginBottom: 14 }}>{notice}</p>
            )}
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(!!directEmail.trim())}
              style={{
                ...buttonStyle,
                opacity: disabled(!!directEmail.trim()) ? 0.6 : 1,
                cursor: disabled(!!directEmail.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.joinOtp.searching : t.joinOtp.sendCodeButton}
            </button>
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button type="button" onClick={startOverEmail} style={linkButtonStyle}>
                {t.joinOtp.backButton}
              </button>
            </div>
          </form>
        )}

        {view === "email_code" && (
          <form onSubmit={submitEmailCode}>
            <h2 style={h2Style}>{t.joinOtp.codeLabel}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.joinOtp.codeSentTo(directEmail.trim())}
            </p>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t.joinOtp.codePlaceholder}
              style={{ ...codeFieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(emailCode.length === 6)}
              style={{
                ...buttonStyle,
                opacity: disabled(emailCode.length === 6) ? 0.6 : 1,
                cursor: disabled(emailCode.length === 6) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.joinOtp.verifying : t.joinOtp.verifyButton}
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 14,
              }}
            >
              <button type="button" onClick={startOverEmail} style={linkButtonStyle}>
                {t.joinOtp.startOverButton}
              </button>
              <button
                type="button"
                onClick={() => requestDirectOtp()}
                disabled={busy}
                style={linkButtonStyle}
              >
                {t.joinOtp.resendButton}
              </button>
            </div>
          </form>
        )}

        {view === "email_matches" && (
          <div>
            <h2 style={h2Style}>{t.joinOtp.matchesTitle}</h2>
            {hasOrganiserAccount && (
              <p style={{ color: "#8a817c", fontSize: 13, marginBottom: 16 }}>
                {t.joinOtp.organiserHintText}{" "}
                <a href="/sign-in" style={{ color: "#43353a", fontWeight: 600 }}>
                  {t.joinOtp.organiserHintLink}
                </a>
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {matches.map((m) => {
                const coupleLabel =
                  [m.wedding_partner_one, m.wedding_partner_two]
                    .filter(Boolean)
                    .join(" & ") || partners;
                return (
                  <button
                    key={m.token}
                    type="button"
                    onClick={() => redirectToGuest(m.token)}
                    style={{
                      ...secondaryButtonStyle,
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {t.joinOtp.matchLine(coupleLabel, m.first_name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- Verified interstitial (shared) ---------------- */}

        {view === "verified" && pendingToken && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            {pendingCoupleLabel && (
              <h2 style={h2Style}>{pendingCoupleLabel}</h2>
            )}
            {savedEmailNotice && (
              <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 14 }}>
                {t.joinOtp.savedEmailNotice}
              </p>
            )}
            {hasOrganiserAccount && (
              <p style={{ color: "#8a817c", fontSize: 13, marginBottom: 20 }}>
                {t.joinOtp.organiserHintText}{" "}
                <a href="/sign-in" style={{ color: "#43353a", fontWeight: 600 }}>
                  {t.joinOtp.organiserHintLink}
                </a>
              </p>
            )}
            <button
              type="button"
              onClick={() => redirectToGuest(pendingToken)}
              style={buttonStyle}
            >
              {t.joinOtp.continueToInvitation}
            </button>
          </div>
        )}

        {/* ---------------- Name-only fallback tier (existing) ---------------- */}

        {view === "name_form" && (
          <form onSubmit={submitNameForm}>
            <h2 style={h2Style}>{t.join.namePromptTitle}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.join.namePromptSubtitle}
            </p>
            <label htmlFor="jn-first" style={labelStyle}>
              {t.join.firstNameLabel}
            </label>
            <input
              id="jn-first"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={fieldStyle}
            />
            <label htmlFor="jn-last" style={labelStyle}>
              {t.join.lastNameLabel}
            </label>
            <input
              id="jn-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(!!firstName.trim())}
              style={{
                ...buttonStyle,
                opacity: disabled(!!firstName.trim()) ? 0.6 : 1,
                cursor: disabled(!!firstName.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.join.searching : t.join.continueButton}
            </button>
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setView("phone_form")}
                style={linkButtonStyle}
              >
                {t.joinOtp.backButton}
              </button>
            </div>
          </form>
        )}

        {view === "name_confirm" && nameMatch && (
          <div style={{ textAlign: "center" }}>
            <h2 style={h2Style}>{t.join.confirmTitle}</h2>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 600,
                color: "#b07c82",
                margin: "8px 0 24px",
              }}
            >
              {nameMatch.first_name} {nameMatch.last_name ?? ""}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={startOverName} style={secondaryButtonStyle}>
                {t.join.noButton}
              </button>
              <button
                type="button"
                onClick={confirmNameYes}
                style={{ ...buttonStyle, flex: 1 }}
              >
                {t.join.yesButton}
              </button>
            </div>
          </div>
        )}

        {view === "name_contact" && (
          <form onSubmit={submitNameContact}>
            <h2 style={h2Style}>{t.join.contactTitle}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.join.contactSubtitle}
            </p>
            <label htmlFor="jn-contact" style={labelStyle}>
              {t.join.contactLabel}
            </label>
            <input
              id="jn-contact"
              autoFocus
              value={nameContact}
              onChange={(e) => setNameContact(e.target.value)}
              placeholder={t.join.contactPlaceholder}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={disabled(!!nameContact.trim())}
              style={{
                ...buttonStyle,
                opacity: disabled(!!nameContact.trim()) ? 0.6 : 1,
                cursor: disabled(!!nameContact.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.join.searching : t.join.contactSubmit}
            </button>
          </form>
        )}

        {view === "name_not_found" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
            <h2 style={h2Style}>{t.join.notFoundTitle}</h2>
            <p style={{ color: "#8a817c", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {t.join.notFoundBody(partners)}
            </p>
            <button type="button" onClick={startOverName} style={buttonStyle}>
              {t.join.tryAgainButton}
            </button>
          </div>
        )}

        {view === "redirecting" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ color: "#8a817c", fontSize: 14 }}>{t.join.redirecting}</p>
          </div>
        )}
      </div>
    </main>
  );
}
