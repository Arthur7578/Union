"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Profile } from "@union/shared";
import { useAuth } from "./auth";
import { fetchProfile } from "./data";

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/** The signed-in person's own record — distinct from `useWedding()`, which is
 *  the wedding they're planning. Mirrors WeddingProvider's shape/timing. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await fetchProfile(session.user.id);
      setProfile(p);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
