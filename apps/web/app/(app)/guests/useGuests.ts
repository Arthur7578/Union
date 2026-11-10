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
 * The "nudge everyone still waiting" action: records the reminder, then opens
 * the couple's mail app with every waiting guest who has an email in Bcc.
 */
export function useRsvpNudge(
  wedding: Pick<Wedding, "partner_one" | "partner_two"> | null,
  guests: GuestWithRsvp[] | null,
  reload: () => Promise<void>,
  t: Dictionary,
) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const waitingWithEmail = useMemo(
    () =>
      (guests ?? []).filter((g) => (g.rsvps?.status ?? "pending") === "pending" && !!g.email),
    [guests],
  );

  const send = async () => {
    if (!wedding || waitingWithEmail.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const to = waitingWithEmail.map((g) => g.email!).join(",");
      const partners =
        [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
        t.guests.theCouple;
      const subject = t.guests.emailSubject(partners);
      const linksLine =
        waitingWithEmail.length === 1
          ? t.guests.emailBody.singleLink(guestLinkUrl(origin, waitingWithEmail[0].invite_token))
          : t.guests.emailBody.multipleLinks;
      const body = `${t.guests.emailBody.hello}\n\n${t.guests.emailBody.lead}${linksLine}\n${t.guests.emailBody.thanks}\n${partners}`;
      const mailto = `mailto:?bcc=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await markRemindersSent(waitingWithEmail.map((g) => g.id));
      await reload();
      if (typeof window !== "undefined") window.location.href = mailto;
      setNote(t.guests.reminderSummary(waitingWithEmail.length));
    } catch (err) {
      setNote(err instanceof Error ? err.message : t.guests.reminderFail);
    } finally {
      setBusy(false);
    }
  };

  return { waitingWithEmail, busy, note, send };
}
