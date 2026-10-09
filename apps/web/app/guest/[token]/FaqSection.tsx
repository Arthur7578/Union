"use client";

import { useLocale } from "@/lib/i18n/client";
import { SectionHead } from "./SectionHead";

/**
 * Frequently asked questions. An answer that points at another part of the
 * hub only does so while that part is on — otherwise it would send guests to
 * something they can't open.
 */
export function FaqSection({
  formsLabel,
  travelLabel,
}: {
  /** The forms section's name, or null when the couple turned it off. */
  formsLabel: string | null;
  /** The travel board's name, or null when the couple turned it off. */
  travelLabel: string | null;
}) {
  const { locale } = useLocale();
  const fr = locale === "fr";

  const items = [
    {
      q: fr ? "Quel est le dress code ?" : "What is the dress code?",
      a: fr
        ? "Tenue élégante de campagne chic. Prévoyez des talons larges ou des chaussures plates pour la pelouse extérieure."
        : "Garden elegant. Grass-friendly footwear is highly recommended as the ceremony and cocktail hour are outdoors.",
    },
    {
      q: fr ? "Les enfants sont-ils invités ?" : "Are children welcome?",
      a: formsLabel
        ? fr
          ? `Regardez « ${formsLabel} » pour savoir si votre invitation s'étend aux enfants et à la famille.`
          : `Check “${formsLabel}” to see if your invitation extends to children / families.`
        : fr
          ? "Les organisateurs vous confirmeront directement si votre invitation s'étend aux enfants et à la famille."
          : "The couple will confirm directly whether your invitation extends to children / families.",
    },
    {
      q: fr ? "Le stationnement est-il disponible sur place ?" : "Is parking available at the venue?",
      a: fr
        ? travelLabel
          ? `Oui, un parking privé gratuit est disponible sur place. Le covoiturage reste conseillé : retrouvez les trajets partagés dans « ${travelLabel} ».`
          : "Oui, un parking privé gratuit est disponible sur place. Le covoiturage reste conseillé."
        : travelLabel
          ? `Yes, ample free parking is available on-site. You can also match with other drivers in “${travelLabel}”.`
          : "Yes, ample free parking is available on-site. Carpooling is still encouraged.",
    },
  ];

  return (
    <>
      <SectionHead
        title={fr ? "Questions fréquentes" : "Questions & answers"}
        lead={
          fr
            ? "Toutes les réponses pour faciliter votre organisation."
            : "Quick answers to help plan your trip and details about the day."
        }
      />
      <div className="gh-faq">
        {items.map((item) => (
          <details key={item.q} className="gh-faq-item">
            <summary>
              <span>{item.q}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
