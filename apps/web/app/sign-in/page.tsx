"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button } from "@/components/ui";
import { useAuth, LAST_EMAIL_KEY } from "@/lib/auth";

export default function SignInPage() {
  const { session, sendEmailOtp, verifyEmailOtp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) router.replace("/today");
  }, [session, router]);

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
      // onAuthStateChange fires and the effect above redirects to /today.
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

  return (
    <main className="page">
      <div className="card">
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
            Union
          </h1>
          <p className="muted" style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
            {step === "email"
              ? "Sign in with your email — we'll send you a 6-digit code."
              : `Enter the 6-digit code we sent to ${email}.`}
          </p>
        </div>

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
              <label htmlFor="code">6-digit code</label>
              <input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                style={{
                  letterSpacing: "0.4em",
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <Button
              type="submit"
              disabled={busy || code.length !== 6}
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
