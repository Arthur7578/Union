"use client";

import { FairePartEnvelope } from "@/components/guest/FairePartEnvelope";
import { useLocale } from "@/lib/i18n/client";

interface GuestWelcomeProps {
  /** Only for a personal link; a group link greets no one by name. */
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  /** Both of these are exactly what the couple has chosen to disclose. */
  venueName?: string | null;
  address?: string | null;
  onRespond: () => void;
}

/** Welcome screen shown to a guest opening their group or individual link. */
export function GuestWelcome({
  guestName,
  partnerOne,
  partnerTwo,
  eventDate,
  venueName,
  address,
  onRespond,
}: GuestWelcomeProps) {
  const { locale } = useLocale();
  const weddingDate = eventDate
    ? new Date(`${eventDate}T00:00:00`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <FairePartEnvelope
      guestName={guestName}
      partnerOne={partnerOne}
      partnerTwo={partnerTwo}
      weddingDate={weddingDate}
      place={venueName || address}
      venue={[venueName, address].filter(Boolean).join(", ")}
      onRespond={onRespond}
    />
  );
}
