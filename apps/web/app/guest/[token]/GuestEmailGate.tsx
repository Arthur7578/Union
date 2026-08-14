"use client";

import React, { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { writeActiveGuestIdentity } from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";

type Step = "email" | "code" | "complete";

interface CompleteEmailSetupResult {
  status:
    | "verified"
    | "not_authenticated"
    | "email_not_verified"
    | "email_already_set"
    | "not_found";
}

export function GuestEmailGate({
  token,
  guestId,
  guestName,
  emailMissing,
  children,
}: {
  token: string;
  guestId: string;
  guestName: string;
  emailMissing: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const [step, setStep] = useState<Step>(emailMissing ? "email" : "complete");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (step === "complete") return <>{children}</>;

  const requestCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendEmailOtp(email);
      setCode("");
      setStep("code");
    } catch {
      setError(t.guestEmailSetup.sendError);
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    void requestCode();
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "complete_guest_email_setup",
        { p_token: token },
      );
      if (rpcError) throw rpcError;

      const result = data as unknown as CompleteEmailSetupResult;
      if (result.status !== "verified") {
        throw new Error(result.status);
      }

      const { data: authData } = await supabase.auth.getSession();
      if (authData.session) {
        writeActiveGuestIdentity({
          userId: authData.session.user.id,
          guestId,
          guestName,
        });
      }
      setStep("complete");
    } catch {
      setError(t.guestEmailSetup.verifyError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LanguageSwitcher />
      </div>
      <section style={cardStyle}>
        <div style={kickerStyle}>{t.guestEmailSetup.kicker}</div>
        <h1 style={titleStyle}>
          {step === "email"
            ? t.guestEmailSetup.title
            : t.guestEmailSetup.codeTitle}
        </h1>
        <p style={bodyStyle}>
          {step === "email"
            ? t.guestEmailSetup.subtitle
            : t.guestEmailSetup.codeSent(email)}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        {step === "email" ? (
          <form onSubmit={submitEmail} style={{ display: "grid", gap: 16 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t.guestEmailSetup.emailLabel}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.guestEmailSetup.emailPlaceholder}
                required
                style={inputStyle}
              />
            </label>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy
                ? t.guestEmailSetup.sending
                : t.guestEmailSetup.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} style={{ display: "grid", gap: 16 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t.guestEmailSetup.codeLabel}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t.guestEmailSetup.codePlaceholder}
                required
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  letterSpacing: "0.25em",
                  fontSize: 20,
                }}
              />
            </label>
            <button disabled={busy} style={primaryButtonStyle}>
              {busy
                ? t.guestEmailSetup.verifying
                : t.guestEmailSetup.verify}
            </button>
            <div style={linkRowStyle}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void requestCode()}
                style={textButtonStyle}
              >
                {t.guestEmailSetup.resend}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
                style={textButtonStyle}
              >
                {t.guestEmailSetup.changeEmail}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
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
  textAlign: "center",
};

const kickerStyle: React.CSSProperties = {
  color: "#9a7d66",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 32,
  lineHeight: 1.15,
  margin: "0 0 12px",
  fontWeight: 600,
};

const bodyStyle: React.CSSProperties = {
  color: "#756b65",
  fontSize: 15,
  lineHeight: 1.55,
  margin: "0 0 22px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  textAlign: "left",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#4f4742",
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

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 12,
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
