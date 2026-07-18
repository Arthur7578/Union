"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function SignInPage() {
  const { session, signInWithOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/today");
  }, [session, router]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithOtp(email);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(email, code);
      router.replace("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
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
              ? "Sign in with your email — we'll send a one-time code."
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
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={confirm}>
            <div className="field">
              <label htmlFor="code">One-time code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
            {error && <div className="error">{error}</div>}
            <Button type="submit" disabled={busy || !code} style={{ width: "100%" }}>
              {busy ? "Verifying…" : "Verify & continue"}
            </Button>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button
                type="button"
                className="u-link"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                Use a different email
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
