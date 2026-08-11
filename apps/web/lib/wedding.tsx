"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Wedding } from "@union/shared";
import { acceptPendingInvites, useAuth } from "./auth";
import { fetchWeddings } from "./data";
import {
  ACTIVE_WEDDING_KEY,
  INVITED_WEDDING_KEY,
} from "./weddingSelection";

type WeddingContextValue = {
  wedding: Wedding | null;
  weddings: Wedding[];
  needsSelection: boolean;
  selectionIssue: "invited_wedding_unavailable" | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setWedding: (w: Wedding | null) => void;
};

const WeddingContext = createContext<WeddingContextValue | undefined>(undefined);

export function WeddingProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [selectionIssue, setSelectionIssue] = useState<
    "invited_wedding_unavailable" | null
  >(null);
  const [loading, setLoading] = useState(true);

  const chooseWedding = useCallback((next: Wedding | null) => {
    setWedding(next);
    setSelectionIssue(null);
    setWeddings((current) => {
      if (!next) return current;
      const found = current.some((w) => w.id === next.id);
      return found
        ? current.map((w) => (w.id === next.id ? next : w))
        : [...current, next];
    });
    try {
      if (next) window.sessionStorage.setItem(ACTIVE_WEDDING_KEY, next.id);
      else window.sessionStorage.removeItem(ACTIVE_WEDDING_KEY);
      window.sessionStorage.removeItem(INVITED_WEDDING_KEY);
      // Stop older deployments from silently selecting a wedding next login.
      window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
    } catch {
      // Best-effort preference only.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setWedding(null);
      setWeddings([]);
      setSelectionIssue(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Invitation acceptance must finish before fetching weddings. Otherwise
      // RLS cannot see the just-invited wedding and the app picks another one.
      await acceptPendingInvites().catch(() => {});

      let invitedWeddingId: string | null = null;
      let activeWeddingId: string | null = null;
      try {
        const requested = new URLSearchParams(window.location.search).get("wedding");
        invitedWeddingId =
          requested || window.sessionStorage.getItem(INVITED_WEDDING_KEY);
        activeWeddingId = window.sessionStorage.getItem(ACTIVE_WEDDING_KEY);
      } catch {
        // Storage can be unavailable in private browsing; RLS-backed fallback
        // resolution below still finds accessible weddings.
      }
      const available = await fetchWeddings();
      setWeddings(available);
      const invited = invitedWeddingId
        ? available.find((w) => w.id === invitedWeddingId) ?? null
        : null;
      const active = activeWeddingId
        ? available.find((w) => w.id === activeWeddingId) ?? null
        : null;

      // An emailed invitation is an explicit destination. Never replace it
      // with another wedding just because RLS did not return the requested
      // one; that was the source of the misleading cross-wedding redirect.
      const next = invitedWeddingId
        ? invited
        : active || (available.length === 1 ? available[0] : null);
      setSelectionIssue(
        invitedWeddingId && !invited ? "invited_wedding_unavailable" : null,
      );
      setWedding(next);
      if (next) {
        try {
          window.sessionStorage.setItem(ACTIVE_WEDDING_KEY, next.id);
          if (invited) window.sessionStorage.removeItem(INVITED_WEDDING_KEY);
          window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
        } catch {
          // Best-effort preference only.
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Wait for auth to resolve; otherwise loading briefly flips false with
  // session still null and the route guard redirects before access is known.
  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return (
    <WeddingContext.Provider
      value={{
        wedding,
        weddings,
        needsSelection:
          !loading &&
          !wedding &&
          (weddings.length > 1 ||
            selectionIssue === "invited_wedding_unavailable"),
        selectionIssue,
        loading,
        refresh,
        setWedding: chooseWedding,
      }}
    >
      {children}
    </WeddingContext.Provider>
  );
}

export function useWedding(): WeddingContextValue {
  const ctx = useContext(WeddingContext);
  if (!ctx) throw new Error("useWedding must be used within a WeddingProvider");
  return ctx;
}
