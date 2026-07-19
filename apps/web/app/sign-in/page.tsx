"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { useAuth, LAST_EMAIL_KEY } from "@/lib/auth";

export default function SignInPage() {
  const { session, loading: authLoading, signInWithMagicLink, signOut } =
    useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
  // visitor may have arrived here on purpose (a stale bookmark, a stale magic
  // link, hitting Back after signing out) — an auto-nav steals their click if
  // what they actually wanted was to switch accounts. Landing (`/`) still
  // auto-redirects, so nobody who just wants the app has to click.
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
            ? "Sign in with your email — we'll send you a secure link."
            : `We sent a sign-in link to ${email}.`,
        )}

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
