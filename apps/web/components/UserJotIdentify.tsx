"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ujIdentify } from "@/lib/userjot";

/**
 * Links UserJot feedback to the signed-in user. Rendered inside the
 * authenticated provider tree so it has access to the auth session.
 */
export function UserJotIdentify() {
  const { session } = useAuth();

  useEffect(() => {
    const user = session?.user;
    if (!user) return;

    const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    ujIdentify({
      id: user.id,
      email: user.email,
      firstName: meta.first_name ?? meta.given_name,
      lastName: meta.last_name ?? meta.family_name,
      avatar: meta.avatar_url ?? meta.picture,
    });
  }, [session]);

  return null;
}
