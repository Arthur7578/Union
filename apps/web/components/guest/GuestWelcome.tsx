"use client";

import { FairePartEnvelope } from "@/components/guest/FairePartEnvelope";

interface GuestWelcomeProps {
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  address?: string | null;
  message?: string | null;
  locale: string;
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
  message,
  locale,
  onRespond,
}: GuestWelcomeProps) {
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
      welcomeNote={message}
      locale={locale}
      onRespond={onRespond}
    />
  );
}
