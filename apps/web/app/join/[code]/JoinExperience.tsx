"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guestLinkPath } from "@union/shared";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LAST_EMAIL_KEY, sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { looksLikeEmail } from "@/lib/emailSuggest";
import { markGroupLinkArrival } from "@/lib/groupLinkArrival";
import { writeActiveGuestIdentity } from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useTurnstile } from "@/lib/turnstile";
import type { JoinWeddingPreview } from "./page";
import { G, T, alpha } from "@/lib/theme";

/**
 * The group link, after the welcome: a guest finds their own invitation by
 * name. Their first name, then their last name only when several guests
 * share that first name. In secure mode they then confirm an email with a
 * code (the one the couple entered, or their own, which then secures the
 * invitation); in light mode the name alone opens it.
 *
 * A browser already signed in goes straight to the invitation that account
 * secured, or lets the guest pick among that account's own invitations.
 */

type View =
  | "checking"
  | "pick"
  | "name"
  | "last_name"
  | "email"
  | "code"
  | "not_found"
  | "ambiguous"
  | "already_secured"
  | "redirecting";

interface FindResult {
  status:
    | "match"
    | "needs_last_name"
    | "ambiguous"
    | "not_found"
    | "invalid_link"
    | "rate_limited";
  mode?: "secure" | "light";
  token?: string;
  guest_id?: string;
}

interface CheckEmailResult {
  status:
    | "ok"
    | "email_mismatch"
    | "already_secured"
    | "invalid_email"
    | "not_found"
    | "invalid_link"
    | "rate_limited";
}

interface SecureResult {
  status:
    | "verified"
    | "not_authenticated"
    | "email_not_confirmed"
    | "email_mismatch"
    | "already_secured"
    | "not_found"
    | "invalid_link";
  token?: string;
  guest_id?: string;
  first_name?: string;
  last_name?: string | null;
}

interface AccessOption {
  guest_id: string;
  first_name: string;
  last_name: string | null;
}

interface AccessOptionsResult {
  status: "ok" | "not_authenticated";
  matches?: AccessOption[];
}

function readLastEmail(): string {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

const fullName = (first: string, last?: string | null) =>
  [first, last].filter(Boolean).join(" ");

export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const secureMode = preview.guest_join_auth_mode !== "light";
  const [view, setView] = useState<View>(secureMode ? "checking" : "name");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [email, setEmail] = useState(() => (secureMode ? readLastEmail() : ""));
  const [otp, setOtp] = useState("");
  const [options, setOptions] = useState<AccessOption[]>([]);
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
      markGroupLinkArrival(token);
      // They have just read the invitation, so their own link needn't repeat
      // it. Best-effort: failing to record it only means seeing it again.
      void getBrowserSupabase()
        .rpc("mark_welcome_seen", { p_token: token })
        .then(undefined, () => {})
        .then(() => router.push(guestLinkPath(token)));
    },
    [router],
  );

  /**
   * Opens the invitation for the signed-in account, if it may. Returns the
   * outcome so each caller decides what a refusal means for it.
   */
  const secureWithSession = useCallback(
    async (id: string): Promise<SecureResult["status"]> => {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "secure_guest_invitation",
        { p_join_code: code, p_guest_id: id },
      );
      if (rpcError) throw rpcError;
      const result = data as unknown as SecureResult;
      if (result.status === "verified" && result.token) {
        const { data: auth } = await supabase.auth.getSession();
        if (auth.session) {
          writeActiveGuestIdentity({
            userId: auth.session.user.id,
            guestId: id,
            guestName: fullName(result.first_name ?? "", result.last_name),
          });
        }
        redirectToGuest(result.token);
      }
      return result.status;
    },
    [code, redirectToGuest],
  );

  // The check on arrival runs once per page: re-running it (a new router
  // object, a new callback) would pull the guest back off a later step.
  const secureWithSessionRef = useRef(secureWithSession);
  useEffect(() => {
    secureWithSessionRef.current = secureWithSession;
  }, [secureWithSession]);

  useEffect(() => {
    if (!secureMode) return;
    let active = true;

    const start = async () => {
      const supabase = getBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return "name" as const;

      const { data: optionsData, error: rpcError } = await supabase.rpc(
        "get_guest_access_options",
        { p_join_code: code },
      );
      if (rpcError) return "name" as const;
      const found = (optionsData as unknown as AccessOptionsResult).matches ?? [];
      if (!active) return null;
      if (found.length === 1) {
        const status = await secureWithSessionRef.current(found[0].guest_id);
        return status === "verified" ? null : ("name" as const);
      }
      if (found.length > 1) {
        setOptions(found);
        return "pick" as const;
      }
      return "name" as const;
    };

    void start()
      .catch(() => "name" as const)
      .then((next) => {
        if (active && next) setView(next);
      });

    return () => {
      active = false;
    };
  }, [code, secureMode]);

  const findByName = async (withLastName: boolean) => {
    if (!firstName.trim() || (withLastName && !lastName.trim())) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("find_guest_for_join", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: withLastName ? lastName.trim() : null,
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as FindResult;

      if (result.status === "match") {
        if (result.mode === "light" && result.token) {
          redirectToGuest(result.token);
          return;
        }
        if (result.guest_id) {
          setGuestId(result.guest_id);
          // No code when this device's account already holds this very
          // invitation. Anything else goes through the email step, so a
          // signed-in visitor typing someone else's name can never attach
          // their own email to that guest's invitation.
          const { data: auth } = await supabase.auth.getSession();
          if (auth.session) {
            const { data: own } = await supabase.rpc("get_guest_access_options", {
              p_join_code: code,
            });
            const mine = ((own as unknown as AccessOptionsResult | null)?.matches ?? []).some(
              (option) => option.guest_id === result.guest_id,
            );
            if (mine && (await secureWithSession(result.guest_id)) === "verified") return;
          }
          setView("email");
          return;
        }
      }
      if (result.status === "needs_last_name") {
        setView("last_name");
        return;
      }
      if (result.status === "ambiguous") {
        setView("ambiguous");
        return;
      }
      if (result.status === "rate_limited") {
        setError(t.guestJoin.rateLimited);
        return;
      }
      setView("not_found");
    } catch {
      setError(t.guestJoin.genericError);
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    const cleanEmail = email.trim();
    if (!guestId || !cleanEmail) return;
    if (!looksLikeEmail(cleanEmail)) {
      setError(t.guestJoin.invalidEmail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("check_join_email", {
        p_join_code: code,
        p_guest_id: guestId,
        p_email: cleanEmail,
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as CheckEmailResult;
      if (result.status === "already_secured") {
        setView("already_secured");
        return;
      }
      if (result.status !== "ok") {
        setError(
          result.status === "email_mismatch"
            ? t.guestJoin.emailMismatch(partners)
            : result.status === "invalid_email"
              ? t.guestJoin.invalidEmail
              : result.status === "rate_limited"
                ? t.guestJoin.rateLimited
                : t.guestJoin.genericError,
        );
        return;
      }
      try {
        await sendEmailOtp(cleanEmail, await getCaptchaToken());
      } catch {
        setError(t.guestJoin.sendCodeError);
        return;
      }
      setOtp("");
      setView("code");
    } catch {
      setError(t.guestJoin.genericError);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!guestId || !otp.trim()) return;
    setBusy(true);
    setError(null);
    try {
      try {
        await verifyEmailOtp(email, otp);
      } catch {
        setError(t.guestJoin.invalidCode);
        return;
      }
      const status = await secureWithSession(guestId);
      if (status === "verified") return;
      if (status === "already_secured") {
        setView("already_secured");
      } else if (status === "email_mismatch") {
        setError(t.guestJoin.emailMismatch(partners));
        setView("email");
      } else {
        setError(t.guestJoin.genericError);
      }
    } catch {
      setError(t.guestJoin.genericError);
    } finally {
      setBusy(false);
    }
  };

  const pickOption = async (option: AccessOption) => {
    setBusy(true);
    setError(null);
    try {
      const status = await secureWithSession(option.guest_id);
      if (status !== "verified") setError(t.guestJoin.genericError);
    } catch {
      setError(t.guestJoin.genericError);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setFirstName("");
    setLastName("");
    setGuestId(null);
    setOtp("");
    setError(null);
    setView("name");
  };

  const onSubmit = (action: () => Promise<void>) => (event: React.FormEvent) => {
    event.preventDefault();
    void action();
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

    if (view === "pick") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.pickTitle}</h2>
          <p style={bodyStyle}>{t.guestJoin.pickSubtitle}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {options.map((option) => (
              <button
                key={option.guest_id}
                type="button"
                disabled={busy}
                onClick={() => void pickOption(option)}
                style={primaryButtonStyle}
              >
                {fullName(option.first_name, option.last_name)}
              </button>
            ))}
          </div>
          <div style={linkRowStyle}>
            <button type="button" onClick={startOver} style={textButtonStyle}>
              {t.guestJoin.someoneElse}
            </button>
          </div>
        </>
      );
    }

    if (view === "name" || view === "last_name") {
      const askingLastName = view === "last_name";
      return (
        <>
          <h2 style={titleStyle}>
            {askingLastName ? t.guestJoin.lastNameTitle : t.guestJoin.title}
          </h2>
          <p style={bodyStyle}>
            {askingLastName
              ? t.guestJoin.lastNameSubtitle(firstName.trim())
              : t.guestJoin.nameSubtitle}
          </p>
          <form
            onSubmit={onSubmit(() => findByName(askingLastName))}
            style={{ display: "grid", gap: 16 }}
          >
            {askingLastName ? (
              <FieldLabel label={t.guestJoin.lastNameLabel}>
                <input
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </FieldLabel>
            ) : (
              <FieldLabel label={t.guestJoin.firstNameLabel}>
                <input
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  style={inputStyle}
                />
              </FieldLabel>
            )}
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.guestJoin.searching : t.guestJoin.continueButton}
            </button>
          </form>
          {askingLastName ? (
            <div style={linkRowStyle}>
              <button type="button" onClick={startOver} style={textButtonStyle}>
                {t.guestJoin.tryAgainButton}
              </button>
            </div>
          ) : (
            <p style={securityStyle}>{t.guestJoin.securityNote}</p>
          )}
        </>
      );
    }

    if (view === "email") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.emailTitle}</h2>
          <p style={bodyStyle}>{t.guestJoin.emailSubtitle}</p>
          <form onSubmit={onSubmit(requestCode)} style={{ display: "grid", gap: 16 }}>
            <FieldLabel label={t.guestJoin.emailLabel}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.guestJoin.emailPlaceholder}
                required
                style={inputStyle}
              />
            </FieldLabel>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy ? t.guestJoin.sending : t.guestJoin.sendCodeButton}
            </button>
          </form>
          <div style={linkRowStyle}>
            <button type="button" onClick={startOver} style={textButtonStyle}>
              {t.guestJoin.someoneElse}
            </button>
          </div>
        </>
      );
    }

    if (view === "code") {
      return (
        <>
          <h2 style={titleStyle}>{t.guestJoin.codeTitle}</h2>
          <p style={bodyStyle}>{t.guestJoin.codeSent(email.trim())}</p>
          <form onSubmit={onSubmit(submitCode)} style={{ display: "grid", gap: 16 }}>
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
              onClick={() => void requestCode()}
              style={textButtonStyle}
            >
              {t.guestJoin.resendButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView("email");
              }}
              style={textButtonStyle}
            >
              {t.guestJoin.changeEmail}
            </button>
          </div>
        </>
      );
    }

    const [title, body] =
      view === "ambiguous"
        ? [t.guestJoin.ambiguousTitle, t.guestJoin.ambiguousBody(partners)]
        : view === "already_secured"
          ? [t.guestJoin.alreadySecuredTitle, t.guestJoin.alreadySecuredBody(partners)]
          : [t.guestJoin.notFoundTitle, t.guestJoin.notFoundBody(partners)];

    return (
      <>
        <h2 style={titleStyle}>{title}</h2>
        <p style={bodyStyle}>{body}</p>
        <button type="button" onClick={startOver} style={primaryButtonStyle}>
          {t.guestJoin.tryAgainButton}
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
