"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import { UserJotIdentify } from "@/components/UserJotIdentify";
import { Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useWedding } from "@/lib/wedding";
import { supabaseConfigured } from "@/lib/supabaseClient";
import { ConfigNotice } from "@/components/ConfigNotice";
import { useT } from "@/lib/i18n/client";

function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const {
    wedding,
    invitedWeddingId,
    needsSelection,
    loading: wLoading,
  } = useWedding();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    if (!wLoading && invitedWeddingId) {
      router.replace("/invitation");
      return;
    }
    if (!wLoading && !wedding) {
      router.replace(needsSelection ? "/choose-wedding" : "/onboarding");
    }
  }, [
    authLoading,
    session,
    wLoading,
    wedding,
    invitedWeddingId,
    needsSelection,
    router,
  ]);

  if (authLoading || (session && wLoading)) {
    return (
      <div className="u-app">
        <Loading label={t.today.openingUnion} />
      </div>
    );
  }
  if (!session || !wedding || invitedWeddingId) {
    return (
      <div className="u-app">
        <Loading label={t.common.oneMoment} />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <ConfigNotice />;
  return (
    <Providers>
      <UserJotIdentify />
      <Guard>{children}</Guard>
    </Providers>
  );
}
