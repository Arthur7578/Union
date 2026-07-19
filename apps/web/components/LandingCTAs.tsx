"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getBrowserSupabase } from "@/lib/supabaseClient";

/**
 * Renders the landing-page CTAs and steers signed-in visitors into the app.
 *
 * Auto-redirect alone is fragile: if Supabase's URL detection, the router push,
 * or the network hitches, a signed-in visitor is left staring at "Get started" /
 * "Sign in" — copy that reads as if they had no account — with no visible way
 * in. We swap in an "Open Union" CTA the moment a session is known, so the door
 * is always in front of them even when the redirect doesn't fire.
 */
export function LandingCTAs({ to }: { to: string }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const has = Boolean(data.session);
      setSignedIn(has);
      if (has) router.replace(to);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const has = Boolean(session);
      setSignedIn(has);
      if (has) router.replace(to);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, to]);

  const row: React.CSSProperties = {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 30,
  };
  const primary: React.CSSProperties = {
    minHeight: 50,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 26px",
    borderRadius: 15,
    background: T.accent,
    color: "#fff",
    fontWeight: 600,
    fontSize: 16,
    boxShadow: "0 6px 16px rgba(67,53,58,.16)",
  };
  const secondary: React.CSSProperties = {
    minHeight: 50,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 26px",
    borderRadius: 15,
    background: "transparent",
    border: `1px solid ${T.line3}`,
    color: T.ink,
    fontWeight: 600,
    fontSize: 16,
  };

  if (signedIn) {
    return (
      <div style={row}>
        <Link href={to} style={primary}>
          Open Union →
        </Link>
      </div>
    );
  }

  return (
    <div style={row}>
      <Link href="/sign-in" style={primary}>
        Get started
      </Link>
      <Link href="/sign-in" style={secondary}>
        Sign in
      </Link>
    </div>
  );
}
