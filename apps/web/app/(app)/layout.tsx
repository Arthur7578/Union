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

function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { wedding, loading: wLoading } = useWedding();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    if (!wLoading && !wedding) {
      router.replace("/onboarding");
    }
  }, [authLoading, session, wLoading, wedding, router]);

  if (authLoading || (session && wLoading)) {
    return (
      <div className="u-app">
        <Loading label="Opening Union…" />
      </div>
    );
  }
  if (!session || !wedding) {
    return (
      <div className="u-app">
        <Loading label="One moment…" />
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
