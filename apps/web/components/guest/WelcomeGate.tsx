"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GuestWelcome } from "@/components/guest/GuestWelcome";
import { useLocale } from "@/lib/i18n/client";
import { markRsvpHandoff } from "@/lib/rsvpHandoff";
import { getBrowserSupabase } from "@/lib/supabaseClient";

const ReplayWelcome = createContext<(() => void) | null>(null);

/** Lets the guest hub offer "see the invitation again". Null outside a WelcomeGate. */
export function useReplayWelcome() {
  return useContext(ReplayWelcome);
}

const Responses = createContext(0);

/**
 * How many times "Respond to the invitation" has been chosen since the page
 * opened. The hub watches it to open the RSVP straight away (with the
 * handoff in lib/rsvpHandoff), including after a replay of the welcome.
 */
export function useWelcomeResponses() {
  return useContext(Responses);
}

/**
 * The invitation comes first: the faire-part welcome shows before any identity
 * or e-mail step, and "Respond to the invitation" hands over to `children`
 * (those steps, then the hub). The hub can replay it.
 *
 * Whether it has been seen is remembered on the guest, for a personal link
 * (`token`, with `seen` from the invitation), so it follows them to another
 * device. A group link always shows it: it is a shared door, and the device
 * can't know who is arriving (a shared computer, a family tablet).
 *
 * The guest's own language pick on the welcome is recorded on their invitation
 * too (personal links), as the hub used to do on its own.
 */
export function WelcomeGate({
  token,
  seen,
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

  const [override, setOverride] = useState<"welcome" | "done" | null>(null);
  const state = override ?? (seen ? "done" : "welcome");
  const [responses, setResponses] = useState(0);
  // Once shown, the hub stays mounted (hidden) while the welcome is replayed,
  // so what the guest did there — a reply just sent — survives the replay.
  const [entered, setEntered] = useState(state === "done");

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

  const welcome =
    state === "welcome" ? (
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
          if (token) markRsvpHandoff(token);
          window.scrollTo(0, 0);
          setOverride("done");
          setEntered(true);
          setResponses((n) => n + 1);
        }}
      />
    ) : null;

  if (!entered) return welcome;
  return (
    <>
      {welcome}
      <div hidden={state === "welcome"}>
        <Responses.Provider value={responses}>
          <ReplayWelcome.Provider value={replay}>{children}</ReplayWelcome.Provider>
        </Responses.Provider>
      </div>
    </>
  );
}
