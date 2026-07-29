"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { useAuth, LAST_EMAIL_KEY } from "@/lib/auth";

export default function SignInPage() {
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
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Prefill from the last email used on this browser so returning visitors
  // don't have to retype it.
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
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
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
      // onAuthStateChange fires and the already-signed-in branch below picks
      // up the new session on the next render.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That code didn't work — try again.",
      );
    } finally {
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
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
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

  // Auth hasn't resolved yet — don't flash the sign-in form to someone who is
  // in fact already signed in.
  if (authLoading) {
    return (
      <main className="page">
        <div className="card">
          <Loading label="Checking your sign-in…" />
        </div>
      </main>
    );
  }

  // Already signed in. Skip the redirect and show an explicit panel: the
  // visitor may have arrived here on purpose (a stale bookmark, hitting Back
  // after signing out) — an auto-nav steals their click if what they actually
  // wanted was to switch accounts. Landing (`/`) still auto-redirects, so
  // nobody who just wants the app has to click.
  if (session) {
    const who = session.user?.email;
    const doSignOut = async () => {
      setSignOutError(null);
      setSigningOut(true);
      try {
        await signOut();
      } catch (err) {
        setSignOutError(
          err instanceof Error ? err.message : "Couldn't sign you out.",
        );
      } finally {
        setSigningOut(false);
      }
    };

    return (
      <main className="page">
        <div className="card">
          {header(
            "You're already signed in",
            who
              ? `Signed in as ${who}. Head into Union — or sign out to use a different email.`
              : "You're signed in. Head into Union — or sign out to use a different email.",
          )}
          <Button
            type="button"
            onClick={() => router.replace("/today")}
            style={{ width: "100%" }}
          >
            Continue to Union
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={doSignOut}
            disabled={signingOut}
            style={{ width: "100%", marginTop: 10 }}
          >
            {signingOut ? "Signing out…" : "Sign out and use a different email"}
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
            <Link href="/">← Back to home</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        {header(
          "Union",
          step === "email"
            ? "Sign in with your email — we'll send you an 8-digit code."
            : `Enter the 8-digit code we sent to ${email}.`,
        )}

        {step === "email" ? (
          <form onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <div className="error">{error}</div>}
            <Button type="submit" disabled={busy || !email} style={{ width: "100%" }}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="field">
              <label htmlFor="code">8-digit code</label>
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
                placeholder="12345678"
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
              {busy ? "Verifying…" : "Sign in"}
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
                Use a different email
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
                Resend code
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
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
