"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { guestLinkUrl, type Wedding } from "@union/shared";
import { fetchGuests, markRemindersSent, type GuestWithRsvp } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/** The wedding's guests with their RSVP, `null` while loading. */
export function useGuests(weddingId: string | undefined) {
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);

  useEffect(() => {
    if (!weddingId) return;
    let ok = true;
    fetchGuests(weddingId)
      .then((g) => ok && setGuests(g))
      .catch(() => ok && setGuests([]));
    return () => {
      ok = false;
    };
  }, [weddingId]);

  const reload = useCallback(async () => {
    if (!weddingId) return;
    setGuests(await fetchGuests(weddingId));
  }, [weddingId]);

  return { guests, reload };
}

/**
 * The "nudge everyone still waiting" action, in manual mode (see
 * lib/reminders.ts): it builds the email for the couple's own mail app,
 * with every waiting guest who has an email in Bcc. Opening the mail app
 * records nothing, since Union can't know the email was sent; the couple
 * can then note those guests as nudged, or not.
 */
export function useRsvpNudge(
  wedding: Pick<Wedding, "partner_one" | "partner_two"> | null,
  guests: GuestWithRsvp[] | null,
  reload: () => Promise<void>,
  t: Dictionary,
) {
  /** Guests in the email the couple just opened, waiting to be noted. */
  const [opened, setOpened] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const waitingWithEmail = useMemo(
    () =>
      (guests ?? []).filter((g) => (g.rsvps?.status ?? "pending") === "pending" && !!g.email),
    [guests],
  );

  const mailto = useMemo(() => {
    if (!wedding || waitingWithEmail.length === 0) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const to = waitingWithEmail.map((g) => g.email!).join(",");
    const partners =
      [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") || t.guests.theCouple;
    const subject = t.guests.emailSubject(partners);
    const linksLine =
      waitingWithEmail.length === 1
        ? t.guests.emailBody.singleLink(guestLinkUrl(origin, waitingWithEmail[0].invite_token))
        : t.guests.emailBody.multipleLinks;
    const body = `${t.guests.emailBody.hello}\n\n${t.guests.emailBody.lead}${linksLine}\n${t.guests.emailBody.thanks}\n${partners}`;
    return `mailto:?bcc=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [wedding, waitingWithEmail, t]);

  /** The mail app is opening: remember who was in it, record nothing yet. */
  const onOpen = () => {
    setNote(null);
    setOpened(waitingWithEmail.map((g) => g.id));
  };

  /** The couple says it went out: note those guests as nudged today. */
  const confirm = async () => {
    if (!opened) return;
    setBusy(true);
    try {
      await markRemindersSent(opened);
      await reload();
      setNote(t.guests.hub.nudgeNoted(opened.length));
      setOpened(null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : t.guests.reminderFail);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => setOpened(null);

  return { waitingWithEmail, mailto, opened, onOpen, confirm, dismiss, busy, note };
}
