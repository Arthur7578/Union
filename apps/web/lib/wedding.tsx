"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Wedding } from "@union/shared";
import { useAuth } from "./auth";
import { fetchWedding } from "./data";

type WeddingContextValue = {
  wedding: Wedding | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setWedding: (w: Wedding | null) => void;
};

const WeddingContext = createContext<WeddingContextValue | undefined>(undefined);

export function WeddingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setWedding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const w = await fetchWedding(session.user.id);
      setWedding(w);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <WeddingContext.Provider value={{ wedding, loading, refresh, setWedding }}>
      {children}
    </WeddingContext.Provider>
  );
}

export function useWedding(): WeddingContextValue {
  const ctx = useContext(WeddingContext);
  if (!ctx) throw new Error("useWedding must be used within a WeddingProvider");
  return ctx;
}
