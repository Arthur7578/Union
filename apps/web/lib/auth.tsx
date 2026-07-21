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
 * Send a 6-digit sign-in code to `email`. Standalone (not tied to React
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

/** Verify the 6-digit code the user typed and hydrate the session. */
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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  },
  async verifyEmailOtp() {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  },
  async signOut() {},
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? noopAuth;
}
