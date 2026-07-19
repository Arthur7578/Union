"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { getBrowserSupabase } from "@/lib/supabaseClient";

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
  const [email, setEmail] = useState<string | null>(null);

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

    // If the address rode along on the redirect (?email=…) keep it so the new
    // link can be requested without retyping.
    setEmail(new URLSearchParams(window.location.search).get("email"));

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

  const { title, body } = friendlyMessage(error);
  const signInHref = email
    ? `/sign-in?email=${encodeURIComponent(email)}`
    : "/sign-in";

  return (
    <NoticeShell title={title} body={body}>
      <Link
        href={signInHref}
        onClick={() => setError(null)}
        style={{
          minHeight: 48,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "0 22px",
          borderRadius: 14,
          background: T.accent,
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          boxShadow: "0 6px 16px rgba(67,53,58,.16)",
        }}
      >
        Send me a new link
      </Link>

      <button
        type="button"
        onClick={() => setError(null)}
        style={{
          marginTop: 14,
          background: "transparent",
          border: "none",
          color: T.faint,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Back to home
      </button>
    </NoticeShell>
  );
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
