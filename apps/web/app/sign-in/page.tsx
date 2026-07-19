"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button } from "@/components/ui";
import { useAuth, LAST_EMAIL_KEY } from "@/lib/auth";

export default function SignInPage() {
  const { session, signInWithMagicLink } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/today");
  }, [session, router]);

  // Prefill from the address we forwarded on the link (?email=…), falling back
  // to the last email used on this browser, so an expired-link visitor doesn't
  // have to retype it.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("email");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LAST_EMAIL_KEY);
    } catch {
      stored = null;
    }
    const prefill = fromQuery || stored;
    if (prefill) setEmail((cur) => cur || prefill);
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithMagicLink(email);
      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link.");
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
              ? "Sign in with your email — we'll send you a secure link."
              : `We sent a sign-in link to ${email}.`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendLink}>
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
              {busy ? "Sending…" : "Email me a sign-in link"}
            </Button>
          </form>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: T.faint, textAlign: "center", margin: "0 0 18px" }}>
              Open the email on this device and click the link to finish signing
              in. The link expires in 1 hour.
            </p>
            <Button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              style={{ width: "100%" }}
            >
              Use a different email
            </Button>
          </div>
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
