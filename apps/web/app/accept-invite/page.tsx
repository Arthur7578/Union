"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { supabaseUrl } from "@/lib/supabaseClient";
import { rememberInvitedWedding } from "@/lib/weddingSelection";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Captures the wedding destination before following Supabase's one-time Auth
 * link. If Supabase later falls back to the project's Site URL, the wedding
 * still survives in this tab and wins over any previous selection.
 */
export default function AcceptInvitePage() {
  const t = useT();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    try {
      const prefix = "#confirmation_url=";
      if (!window.location.hash.startsWith(prefix)) throw new Error("Missing link");

      const fragmentValue = window.location.hash.slice(prefix.length);
      const confirmationValue = /^https?:\/\//i.test(fragmentValue)
        ? fragmentValue
        : decodeURIComponent(fragmentValue);
      const confirmation = new URL(confirmationValue);
      const expectedOrigin = new URL(supabaseUrl).origin;
      if (
        confirmation.origin !== expectedOrigin ||
        confirmation.pathname !== "/auth/v1/verify"
      ) {
        throw new Error("Invalid confirmation origin");
      }

      const redirectTo = confirmation.searchParams.get("redirect_to");
      if (redirectTo) {
        const destination = new URL(redirectTo);
        const weddingId = destination.searchParams.get("wedding");
        if (
          destination.origin === window.location.origin &&
          weddingId &&
          UUID_RE.test(weddingId)
        ) {
          rememberInvitedWedding(weddingId);
        }
      }

      window.location.replace(confirmation.toString());
    } catch {
      const timeoutId = window.setTimeout(() => setInvalid(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  return (
    <main className="page">
      <div className="card">
        {invalid ? (
          <>
            <div className="error">{t.signIn.errVerify}</div>
            <Link href="/sign-in">{t.signIn.title}</Link>
          </>
        ) : (
          <Loading label={t.signIn.checking} />
        )}
      </div>
    </main>
  );
}
