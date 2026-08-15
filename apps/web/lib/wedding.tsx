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
  INVITED_WEDDING_KEY,
  clearActiveWeddingPreference,
  readActiveWedding,
  rememberActiveWedding,
  resolveInitialWeddingId,
} from "./weddingSelection";

type WeddingContextValue = {
  wedding: Wedding | null;
  weddings: Wedding[];
  invitedWeddingId: string | null;
  invitedWedding: Wedding | null;
  needsSelection: boolean;
  selectionIssue: "invited_wedding_unavailable" | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setWedding: (w: Wedding | null) => void;
};

const WeddingContext = createContext<WeddingContextValue | undefined>(undefined);

export function WeddingProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const sessionUserId = session?.user.id;
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [invitedWeddingId, setInvitedWeddingId] = useState<string | null>(null);
  const [invitedWedding, setInvitedWedding] = useState<Wedding | null>(null);
  const [selectionIssue, setSelectionIssue] = useState<
    "invited_wedding_unavailable" | null
  >(null);
  const [loading, setLoading] = useState(true);

  const chooseWedding = useCallback((next: Wedding | null) => {
    setWedding(next);
    setInvitedWeddingId(null);
    setInvitedWedding(null);
    setSelectionIssue(null);
    setWeddings((current) => {
      if (!next) return current;
      const found = current.some((w) => w.id === next.id);
      return found
        ? current.map((w) => (w.id === next.id ? next : w))
        : [...current, next];
    });
    try {
      if (next && sessionUserId) {
        rememberActiveWedding(next.id, sessionUserId);
      } else {
        clearActiveWeddingPreference();
      }
      window.sessionStorage.removeItem(INVITED_WEDDING_KEY);
    } catch {
      // Best-effort preference only.
    }
  }, [sessionUserId]);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setWedding(null);
      setWeddings([]);
      setInvitedWeddingId(null);
      setInvitedWedding(null);
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
        activeWeddingId = readActiveWedding(session.user.id);
      } catch {
        // Storage can be unavailable in private browsing; RLS-backed fallback
        // resolution below still finds accessible weddings.
      }
      const available = await fetchWeddings();
      setWeddings(available);
      const invited = invitedWeddingId
        ? available.find((w) => w.id === invitedWeddingId) ?? null
        : null;
      setInvitedWeddingId(invitedWeddingId);
      setInvitedWedding(invited);

      // An emailed invitation is a pending destination, not an implicit
      // selection. Keep it separate until the recipient explicitly opens a
      // wedding on the welcome screen. Never replace an unavailable invited
      // wedding with another wedding.
      const nextId = resolveInitialWeddingId(
        invitedWeddingId,
        activeWeddingId,
        available.map((w) => w.id),
      );
      const next = nextId
        ? available.find((w) => w.id === nextId) ?? null
        : null;
      setSelectionIssue(
        invitedWeddingId && !invited ? "invited_wedding_unavailable" : null,
      );
      setWedding(next);
      if (next) {
        try {
          rememberActiveWedding(next.id, session.user.id);
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
        invitedWeddingId,
        invitedWedding,
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
