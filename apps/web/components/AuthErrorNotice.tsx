"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { LAST_EMAIL_KEY, sendMagicLink } from "@/lib/auth";

/**
 * When a magic / confirmation link is stale, Supabase bounces the browser
 * back to the Site URL with the failure encoded in the URL fragment, e.g.
 * `/#error=access_denied&error_code=otp_expired&error_description=…`.
 *
 * Left unhandled the visitor just sees the marketing landing again with a
 * cryptic hash in the address bar. This component reads that fragment, clears
 * it from the URL, and shows a calm, plain-language explanation with a clear
 * way to get a fresh link.
 */
type AuthError = {
  code: string | null;
  description: string | null;
};

function friendlyMessage(err: AuthError): { title: string; body: string } {
  switch (err.code) {
    case "otp_expired":
      return {
        title: "This link has expired",
        body:
          "Sign-in links are only good for a short window and can be used once. This one has already expired or been used — no problem, we can send you a fresh one.",
      };
    case "access_denied":
      return {
        title: "This link is no longer valid",
        body:
          "This sign-in link can't be used anymore — it may have expired or already been opened. Request a new one below and you'll be signed in.",
      };
    default:
      return {
        title: "Something went wrong with your link",
        body:
          err.description ||
          "We couldn't sign you in with that link. Request a new one below to try again.",
      };
  }
}

export function AuthErrorNotice() {
  const router = useRouter();
  const [error, setError] = useState<AuthError | null>(null);
  // null = still checking; the notice waits so it can pick the right variant.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;

    const params = new URLSearchParams(raw);
    const code = params.get("error_code");
    const topLevel = params.get("error");
    if (!code && !topLevel) return;

    setError({
      code: code ?? topLevel,
      description: params.get("error_description")?.replace(/\+/g, " ") ?? null,
    });

    // Show the visitor which address the new link will go to — from the one
    // we forwarded on the redirect (?email=…), or the last one used on this
    // browser — but keep it editable in case it was the wrong inbox.
    const known =
      new URLSearchParams(window.location.search).get("email") ||
      safeLocalStorageGet(LAST_EMAIL_KEY);
    if (known) setEmail(known);

    // The link may have expired for someone who's already signed in on this
    // device — in that case there's nothing to fix, so we reassure instead of
    // pushing them to request a link they don't need.
    getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)))
      .catch(() => setSignedIn(false));

    // Strip the error fragment so a refresh (or Supabase's own URL parsing)
    // doesn't resurface it, and the address bar reads cleanly.
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search);
  }, []);

  // Wait until we know whether there's a session before rendering, so we don't
  // flash the wrong message.
  if (!error || signedIn === null) return null;

  if (signedIn) {
    return (
      <NoticeShell
        title="You're already signed in"
        body="That link was for signing in — and you already are, so there's nothing more to do. It had simply expired."
      >
        <PrimaryButton onClick={() => { setError(null); router.push("/today"); }}>
          Continue to Union
        </PrimaryButton>
      </NoticeShell>
    );
  }

  if (sent) {
    return (
      <NoticeShell
        title="Check your inbox"
        body={`We sent a fresh sign-in link to ${email}. Open it on this device to finish signing in — it expires in 1 hour.`}
      >
        <button
          type="button"
          onClick={() => setError(null)}
          style={dismissStyle}
        >
          Close
        </button>
      </NoticeShell>
    );
  }

  const { title, body } = friendlyMessage(error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setBusy(true);
    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send the link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NoticeShell title={title} body={body}>
      <form onSubmit={submit} style={{ textAlign: "left" }}>
        <label
          htmlFor="auth-error-email"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: T.muted,
            margin: "0 0 6px 2px",
          }}
        >
          Send the new link to
        </label>
        <input
          id="auth-error-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ marginBottom: 14 }}
        />
        {sendError && (
          <div className="error" style={{ marginTop: 0 }}>
            {sendError}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !email}
          style={{
            minHeight: 48,
            width: "100%",
            border: "none",
            borderRadius: 14,
            background: T.accent,
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            cursor: busy || !email ? "default" : "pointer",
            opacity: busy || !email ? 0.6 : 1,
            boxShadow: "0 6px 16px rgba(67,53,58,.16)",
          }}
        >
          {busy ? "Sending…" : "Send me a new link"}
        </button>
      </form>

      <button type="button" onClick={() => setError(null)} style={dismissStyle}>
        Back to home
      </button>
    </NoticeShell>
  );
}

const dismissStyle: React.CSSProperties = {
  marginTop: 14,
  background: "transparent",
  border: "none",
  color: T.faint,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The centered overlay card shared by both variants. */
function NoticeShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="auth-error-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
      }}
    >
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 20,
          padding: 32,
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(43,39,36,.08)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: T.accentSoft,
            marginBottom: 18,
          }}
        >
          <Spark size={22} color={T.accent} />
        </div>

        <h1
          id="auth-error-title"
          className="u-serif"
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: T.ink,
            margin: "0 0 10px",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: T.muted,
            margin: "0 0 24px",
          }}
        >
          {body}
        </p>

        {children}
      </div>
    </div>
  );
}

/** Full-width primary action used inside the notice card. */
function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 48,
        width: "100%",
        border: "none",
        borderRadius: 14,
        background: T.accent,
        color: "#fff",
        fontWeight: 600,
        fontSize: 15,
        cursor: "pointer",
        boxShadow: "0 6px 16px rgba(67,53,58,.16)",
      }}
    >
      {children}
    </button>
  );
}
