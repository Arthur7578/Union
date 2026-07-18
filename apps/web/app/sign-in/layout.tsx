import React from "react";
import { Providers } from "@/components/Providers";
import { ConfigNotice } from "@/components/ConfigNotice";
import { supabaseConfigured } from "@/lib/supabaseClient";

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) return <ConfigNotice />;
  return <Providers>{children}</Providers>;
}
