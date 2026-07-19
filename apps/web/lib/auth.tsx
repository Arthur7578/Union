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

/** Where we stash the last email a sign-in link was sent to, so we can
 *  prefill the form if the link expires and the visitor asks for a new one
 *  (works on the same browser; harmless when absent). */
export const LAST_EMAIL_KEY = "union.lastEmail";

/**
 * Send a magic sign-in link to `email`. Standalone (not tied to React context)
 * so it can be used both from the AuthProvider and from the expired-link notice
 * that lives above the provider in the tree.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const clean = email.trim();
  // Ride the address along on the redirect so we can prefill the form if the
  // link later expires. Supabase preserves this on the success path, and on the
  // error path too once /sign-in is in the Redirect URL allowlist; localStorage
  // covers the same-browser case regardless.
  const redirect = new URL("/sign-in", window.location.origin);
  redirect.searchParams.set("email", clean);
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirect.toString(),
    },
  });
  if (error) throw error;
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, clean);
  } catch {
    // Private mode / storage disabled — prefill just won't be available.
  }
}

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<void>;
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
      signInWithMagicLink: sendMagicLink,
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
  async signInWithMagicLink() {
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
