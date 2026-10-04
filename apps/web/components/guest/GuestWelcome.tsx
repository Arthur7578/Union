"use client";

import { FairePartEnvelope } from "@/components/guest/FairePartEnvelope";

interface GuestWelcomeProps {
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
      coupleNames={[partnerOne, partnerTwo].filter(Boolean).join(" & ")}
      weddingDate={weddingDate}
      venueName={venueName}
      venueCity={address}
      welcomeNote={message}
      locale={locale}
      onRespond={onRespond}
    />
  );
}
