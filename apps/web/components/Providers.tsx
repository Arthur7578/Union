"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth";
import { WeddingProvider } from "@/lib/wedding";

/** Auth + wedding context for any authenticated area of the app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WeddingProvider>{children}</WeddingProvider>
    </AuthProvider>
  );
}
