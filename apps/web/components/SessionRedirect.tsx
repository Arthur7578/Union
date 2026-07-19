"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseClient";

/**
 * Mount on the marketing landing so a signed-in visitor — or someone who
 * just clicked their magic link and landed on `/#access_token=…` — is
 * routed into the app instead of seeing the landing again. Supabase JS
 * consumes the URL fragment on init (`detectSessionInUrl: true`), which
 * this hook then observes.
 */
export function SessionRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) router.replace(to);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(to);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, to]);

  return null;
}
