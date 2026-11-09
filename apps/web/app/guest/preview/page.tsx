"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Providers } from "@/components/Providers";
import { Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { G } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { GuestEntry } from "../[token]/GuestEntry";
import { loadInvitation } from "../[token]/loadInvitation";
import { asFirstVisit } from "../[token]/previewInvitation";
import type { DBInvitation } from "../[token]/page";

/**
 * "See as a guest": the organiser's own wedding page, as a guest opening
 * their link for the first time sees it. It reads through one of the
 * wedding's guest links, with exactly what the server discloses to a guest
 * (address tier, no shuttle before a yes), then plays it as the demo does:
 * nothing is written, not the welcome, not a reply.
 */
export default function GuestPreviewPage() {
  return (
    <Providers>
      <Preview />
    </Providers>
  );
}

function Preview() {
  const { t } = useLocale();
  const copy = t.guests.modules;
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { wedding, loading: weddingLoading } = useWedding();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "none" } | { kind: "error" } | { kind: "ready"; token: string; invitation: DBInvitation }
  >({ kind: "loading" });

  useEffect(() => {
    if (!authLoading && !session) router.replace("/sign-in");
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!wedding) return;
    let live = true;
    (async () => {
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase
        .from("guests")
        .select("invite_token")
        .eq("wedding_id", wedding.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!live) return;
      if (error) return setState({ kind: "error" });
      const token = data?.[0]?.invite_token as string | undefined;
      if (!token) return setState({ kind: "none" });
      const loaded = await loadInvitation(supabase, token).catch(() => null);
      if (!live) return;
      if (!loaded) return setState({ kind: "error" });
      setState({ kind: "ready", token, invitation: asFirstVisit(loaded.invitation, copy.previewGuestName) });
    })();
    return () => {
      live = false;
    };
  }, [wedding, copy.previewGuestName]);

  if (state.kind === "ready") {
    return <GuestEntry token={state.token} invitation={state.invitation} isDemo emailMissing={false} preview />;
  }
  if (state.kind === "loading" || authLoading || weddingLoading) {
    return (
      <main className="u-main">
        <Loading />
      </main>
    );
  }
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: G.bg, color: G.ink }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p role="alert">{state.kind === "none" ? copy.previewNoGuest : copy.previewError}</p>
        <Link href="/guests/modules">{copy.previewClose}</Link>
      </div>
    </main>
  );
}
