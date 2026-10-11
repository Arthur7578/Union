import React from "react";
import { Providers } from "@/components/Providers";
import { ConfigNotice } from "@/components/ConfigNotice";
import { supabaseConfigured } from "@/lib/supabaseConfig";

export default function ChooseWeddingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) return <ConfigNotice />;
  return <Providers>{children}</Providers>;
}
