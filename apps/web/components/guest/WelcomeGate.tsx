"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GuestWelcome } from "@/components/guest/GuestWelcome";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";

const ReplayWelcome = createContext<(() => void) | null>(null);

/** Lets the guest hub offer "see the invitation again". Null outside a WelcomeGate. */
export function useReplayWelcome() {
  return useContext(ReplayWelcome);
}

const WelcomeShown = createContext(false);

/**
 * Whether the welcome was on screen during this visit (the guest pressed
 * "Respond to the invitation"), as opposed to skipped because this device or
 * this guest had seen it before. The group link uses it so that a guest who
 * never saw the welcome there still gets their own on their invitation.
 */
export function useWelcomeShownThisVisit() {
  return useContext(WelcomeShown);
}

const noopSubscribe = () => () => {};

const deviceKey = (id: string) => `union.welcomeSeen.${id}`;

function readDeviceSeen(id: string) {
  try {
    return window.localStorage.getItem(deviceKey(id)) === "1";
  } catch {
    return false;
  }
}

function writeDeviceSeen(id: string) {
  try {
    window.localStorage.setItem(deviceKey(id), "1");
  } catch {
    // Private mode: the welcome simply shows again next visit.
  }
}

/**
 * The invitation comes first: the faire-part welcome shows before any identity
 * or e-mail step, and "Respond to the invitation" hands over to `children`
 * (those steps, then the hub). The hub can replay it.
 *
 * Whether it has been seen is remembered where we can: on the guest, for a
 * personal link (`token`, with `seen` from the invitation), so it follows them
 * to another device. A group link has no guest yet, so there it is remembered
 * on this device only (`deviceId`).
 *
 * The guest's own language pick on the welcome is recorded on their invitation
 * too (personal links), as the hub used to do on its own.
 */
export function WelcomeGate({
  token,
  seen,
  deviceId,
  isDemo,
  guestName,
  partnerOne,
  partnerTwo,
  eventDate,
  venueName,
  address,
  children,
}: {
  /** The guest's invitation token (personal link). */
  token?: string;
  /** Whether the guest has already seen the welcome, from the invitation. */
  seen?: boolean;
  /** What to remember "seen" under on this device, when there is no `token`. */
  deviceId?: string;
  isDemo?: boolean;
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  address?: string | null;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();

  // localStorage can't be read while rendering on the server, so a device-only
  // gate starts as "pending" (nothing) rather than flashing the envelope at a
  // returning guest.
  const deviceSeen = useSyncExternalStore(
    noopSubscribe,
    () => (deviceId ? readDeviceSeen(deviceId) : false),
    () => (deviceId ? null : false),
  );
  const [override, setOverride] = useState<"welcome" | "done" | null>(null);
  const known = seen ?? deviceSeen;
  const state = override ?? (known === null ? "pending" : known ? "done" : "welcome");

  const replay = useCallback(() => setOverride("welcome"), []);

  // Only a deliberate switch is recorded: the language the page opened in is a
  // guess from the browser or the couple's default, not the guest's choice.
  const openedIn = useRef(locale);
  useEffect(() => {
    if (!token || isDemo || locale === openedIn.current) return;
    void getBrowserSupabase()
      .rpc("set_guest_locale", { p_token: token, p_locale: locale })
      .then(undefined, () => {});
  }, [locale, token, isDemo]);

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
        onRespond={() => {
          if (token && !isDemo) {
            void getBrowserSupabase()
              .rpc("mark_welcome_seen", { p_token: token })
              .then(undefined, () => {});
          }
          if (deviceId) writeDeviceSeen(deviceId);
          window.scrollTo(0, 0);
          setOverride("done");
        }}
      />
    );
  }
  return (
    <ReplayWelcome.Provider value={replay}>
      <WelcomeShown.Provider value={override === "done"}>{children}</WelcomeShown.Provider>
    </ReplayWelcome.Provider>
  );
}
