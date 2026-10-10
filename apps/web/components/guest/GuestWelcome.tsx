"use client";

import { FairePartEnvelope } from "@/components/guest/FairePartEnvelope";
import type { GuestZone } from "@/lib/guestAddress";
import { useLocale } from "@/lib/i18n/client";
import { weddingDateText } from "@/lib/weddingDates";

interface GuestWelcomeProps {
  /** Only for a personal link; a group link greets no one by name. */
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  /** Last day of a wedding that lasts more than one; absent for a single day. */
  eventEndDate?: string | null;
  /** Exactly what the couple has chosen to disclose; see `guestZone`. */
  zone?: GuestZone | null;
  onRespond: () => void;
}

/** Welcome screen shown to a guest opening their group or individual link. */
export function GuestWelcome({
  guestName,
  partnerOne,
  partnerTwo,
  eventDate,
  eventEndDate,
  zone,
  onRespond,
}: GuestWelcomeProps) {
  const { locale } = useLocale();
  return (
    <FairePartEnvelope
      guestName={guestName}
      partnerOne={partnerOne}
      partnerTwo={partnerTwo}
      dates={weddingDateText(eventDate, eventEndDate, locale)}
      zone={zone}
      onRespond={onRespond}
    />
  );
}
