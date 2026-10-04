"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { GuestWelcome } from "@/components/guest/GuestWelcome";
import { useLocale } from "@/lib/i18n/client";

const seenKey = (id: string) => `union.welcomeSeen.${id}`;

const ReplayWelcome = createContext<(() => void) | null>(null);

/** Lets the guest hub offer "see the invitation again". Null outside a WelcomeGate. */
export function useReplayWelcome() {
  return useContext(ReplayWelcome);
}

const noopSubscribe = () => () => {};

/** Remember that this link's welcome has been seen, e.g. on the way from a group link to a guest's own. */
export function markWelcomeSeen(id: string) {
  try {
    window.localStorage.setItem(seenKey(id), "1");
  } catch {
    // Private mode: the welcome simply shows again next visit.
  }
}

function readSeen(id: string) {
  try {
    return window.localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

/**
 * The invitation comes first: the faire-part welcome shows on a guest's first
 * visit, before any identity or e-mail step, and "Respond to the invitation"
 * hands over to `children` (those steps, then the hub). Later visits go
 * straight to `children`; the hub can replay the welcome.
 */
export function WelcomeGate({
  seenId,
  guestName,
  partnerOne,
  partnerTwo,
  eventDate,
  venueName,
  address,
  children,
}: {
  /** What "seen" is remembered under: the invitation token, or the join code. */
  seenId: string;
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  address?: string | null;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();
  // localStorage can't be read while rendering on the server, so the first
  // render is "pending" (nothing), which keeps a returning guest from seeing
  // the envelope flash. After that it follows what the guest does here.
  const seen = useSyncExternalStore(
    noopSubscribe,
    () => readSeen(seenId),
    () => null,
  );
  const [override, setOverride] = useState<"welcome" | "done" | null>(null);
  const state = override ?? (seen === null ? "pending" : seen ? "done" : "welcome");

  const replay = useCallback(() => setOverride("welcome"), []);

  if (state === "pending") return null;
  if (state === "welcome") {
    return (
      <GuestWelcome
        guestName={guestName}
        partnerOne={partnerOne}
        partnerTwo={partnerTwo}
        eventDate={eventDate}
        venueName={venueName}
        address={address}
        locale={locale}
        onRespond={() => {
          markWelcomeSeen(seenId);
          window.scrollTo(0, 0);
          setOverride("done");
        }}
      />
    );
  }
  return <ReplayWelcome.Provider value={replay}>{children}</ReplayWelcome.Provider>;
}
