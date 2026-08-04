"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabaseClient";

/** Where we stash the last email a sign-in code was sent to, so we can
 *  prefill the form on subsequent visits (works on the same browser;
 *  harmless when absent). */
export const LAST_EMAIL_KEY = "union.lastEmail";

/**
 * Send an 8-digit sign-in code to `email`. Standalone (not tied to React
 * context) so it can be used from any component regardless of provider
 * placement.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const clean = email.trim();
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, clean);
  } catch {
    // Private mode / storage disabled — prefill just won't be available.
  }
}

/** Verify the 8-digit code the user typed and hydrate the session. */
export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  await acceptPendingInvites();
}

/**
 * If someone invited this email to plan together, flip that invite from
 * pending to active. Best-effort in every sense: a no-op when nothing is
 * pending, and it swallows its own failures so it can never block sign-in
 * or app boot.
 *
 * Called both right after a code is verified and whenever a session
 * resolves — an invite that lands while you're already signed in would
 * otherwise sit pending until your next sign-in.
 */
export async function acceptPendingInvites(): Promise<void> {
  try {
    await getBrowserSupabase().rpc("accept_pending_invites");
  } catch {
    // ignore — the caller's flow already succeeded without this.
  }
}

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = getBrowserSupabase();

    // Only worth one call per signed-in user id — this runs on every
    // auth event, and re-accepting invites we've already accepted is
    // pure noise.
    let acceptedFor: string | null = null;
    const acceptOnce = (next: Session | null) => {
      const uid = next?.user?.id ?? null;
      if (!uid || uid === acceptedFor) return;
      acceptedFor = uid;
      void acceptPendingInvites();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      acceptOnce(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      acceptOnce(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      sendEmailOtp,
      verifyEmailOtp,
      signOut: async () => {
        const supabase = getBrowserSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const noopAuth: AuthContextValue = {
  session: null,
  loading: false,
  async sendEmailOtp() {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  },
  async verifyEmailOtp() {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  },
  async signOut() {},
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? noopAuth;
}
