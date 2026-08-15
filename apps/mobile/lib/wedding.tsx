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
  const userId = session?.user?.id;
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWedding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const w = await fetchWedding(userId);
      setWedding(w);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeoutId);
  }, [refresh]);

  return (
    <WeddingContext.Provider
      value={{ wedding, loading, refresh, setWedding }}
    >
      {children}
    </WeddingContext.Provider>
  );
}

export function useWedding(): WeddingContextValue {
  const ctx = useContext(WeddingContext);
  if (!ctx) {
    throw new Error("useWedding must be used within a WeddingProvider");
  }
  return ctx;
}
