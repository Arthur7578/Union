"use client";

import type { FairePartCopy } from "@union/shared";
import { FairePartEnvelope } from "@/components/guest/FairePartEnvelope";
import { fairePartLines, type GuestPlace } from "@/lib/fairePart";
import { useLocale } from "@/lib/i18n/client";

interface GuestWelcomeProps {
  /** Only for a personal link; a group link greets no one by name. */
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  /** Last day of a wedding that lasts more than one; absent for a single day. */
  eventEndDate?: string | null;
  /** Exactly what the couple has chosen to disclose; see `guestPlaceFields`. */
  place?: Partial<GuestPlace> | null;
  /** The couple's own wording of the card, where they changed it. */
  copy?: FairePartCopy | null;
  onRespond: () => void;
}

/** Welcome screen shown to a guest opening their group or individual link. */
export function GuestWelcome({
  guestName,
  partnerOne,
  partnerTwo,
  eventDate,
  eventEndDate,
  place,
  copy,
  onRespond,
}: GuestWelcomeProps) {
  const { locale } = useLocale();
  const lines = fairePartLines(
    copy,
    { guestFirstName: guestName, partnerOne, partnerTwo, eventDate, eventEndDate, place },
    locale,
  );
  return (
    <FairePartEnvelope
      guestName={guestName}
      partnerOne={partnerOne}
      partnerTwo={partnerTwo}
      lines={lines}
      onRespond={onRespond}
    />
  );
}
