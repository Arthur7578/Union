"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth";
import { WeddingProvider } from "@/lib/wedding";
import { ProfileProvider } from "@/lib/profile";

/** Auth + wedding + profile context for any authenticated area of the app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WeddingProvider>{children}</WeddingProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
