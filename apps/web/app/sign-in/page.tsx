"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth, LAST_EMAIL_KEY } from "@/lib/auth";
import { useT } from "@/lib/i18n/client";

export default function SignInPage() {
  const t = useT();
  const { session, loading: authLoading, sendEmailOtp, verifyEmailOtp, signOut } =
    useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LAST_EMAIL_KEY);
    } catch {
      stored = null;
    }
    if (stored) setEmail((cur) => cur || stored);
  }, []);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendEmailOtp(email);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.errSend);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyEmailOtp(email, code);
      setRedirecting(true);
      router.replace("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.errVerify);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendEmailOtp(email);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.errSend);
    } finally {
      setBusy(false);
    }
  };

  const header = (title: string, sub: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: 22,
      }}
    >
      <Spark size={26} color={T.accent} />
      <h1
        className="u-serif"
        style={{ fontSize: 34, fontWeight: 600, color: T.ink, margin: "8px 0 4px" }}
      >
        {title}
      </h1>
      <p className="muted" style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
        {sub}
      </p>
    </div>
  );

  const switcherRow = (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: 22,
      }}
    >
      <LanguageSwitcher compact />
    </div>
  );

  if (authLoading || redirecting) {
    return (
      <main className="page">
        <div className="card">
          <Loading label={t.signIn.checking} />
        </div>
      </main>
    );
  }

  if (session) {
    const who = session.user?.email;
    const doSignOut = async () => {
      setSignOutError(null);
      setSigningOut(true);
      try {
        await signOut();
      } catch (err) {
        setSignOutError(
          err instanceof Error ? err.message : t.signIn.errSignOut,
        );
      } finally {
        setSigningOut(false);
      }
    };

    return (
      <main className="page">
        <div className="card">
          {header(
            t.signIn.alreadyTitle,
            who
              ? t.signIn.alreadySubWithEmail(who)
              : t.signIn.alreadySubNoEmail,
          )}
          <Button
            type="button"
            onClick={() => router.replace("/today")}
            style={{ width: "100%" }}
          >
            {t.signIn.continue}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={doSignOut}
            disabled={signingOut}
            style={{ width: "100%", marginTop: 10 }}
          >
            {signingOut ? t.common.signingOut : t.signIn.signOutAndSwitch}
          </Button>
          {signOutError && <div className="error">{signOutError}</div>}
          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 13,
              color: T.faint,
            }}
          >
            <Link href="/">{t.common.backHome}</Link>
          </p>
          {switcherRow}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        {header(
          t.signIn.title,
          step === "email" ? t.signIn.subEmail : t.signIn.subCode(email),
        )}

        {step === "email" ? (
          <form onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="email">{t.signIn.emailLabel}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.signIn.emailPlaceholder}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <Button type="submit" disabled={busy || !email} style={{ width: "100%" }}>
              {busy ? t.signIn.sending : t.signIn.sendCode}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="field">
              <label htmlFor="code">{t.signIn.codeLabel}</label>
              <input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t.signIn.codePlaceholder}
                style={{
                  letterSpacing: "0.35em",
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <Button
              type="submit"
              disabled={busy || code.length !== 8}
              style={{ width: "100%" }}
            >
              {busy ? t.signIn.verifying : t.signIn.submit}
            </Button>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 14,
                fontSize: 13,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setCode("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.faint,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {t.signIn.useDifferentEmail}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.accent,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  padding: 0,
                }}
              >
                {t.signIn.resend}
              </button>
            </div>
          </form>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: T.faint,
          }}
        >
          <Link href="/">{t.common.backHome}</Link>
        </p>
        {switcherRow}
      </div>
    </main>
  );
}
