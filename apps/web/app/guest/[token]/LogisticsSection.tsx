"use client";

import { useLocale } from "@/lib/i18n/client";
import { SectionHead } from "./SectionHead";

// Curated stays recommendation list.
const STAYS = [
  {
    name: "Hood River Hood Hotel",
    type: "Boutique Hotel",
    distance: "12 min from venue",
    price: "$$$",
    rating: "4.8 ★",
    desc: "A gorgeous, historic brick boutique hotel in the heart of downtown Hood River with modern amenities.",
    url: "https://www.hoodriverhotel.com",
    badge: "Recommended Stay",
  },
  {
    name: "Columbia Gorge Hotel & Spa",
    type: "Luxury Resort & Spa",
    distance: "15 min from venue",
    price: "$$$$",
    rating: "4.9 ★",
    desc: "A beautiful, premium resort perched on a cliff overlooking the mighty Columbia River.",
    url: "https://www.columbiagorgehotel.com",
    badge: "Premium Choice",
  },
  {
    name: "Westcliff Lodge",
    type: "Cabins & Lodge",
    distance: "14 min from venue",
    price: "$$",
    rating: "4.6 ★",
    desc: "Secluded forest cabins and lodge rooms with spectacular views of the gorge. Ideal for families.",
    url: "https://www.westclifflodge.com",
    badge: "Great Views",
  },
];

/** The venue, the day's schedule and where to stay. */
export function LogisticsSection({
  venueName,
  addressText,
}: {
  venueName: string | null | undefined;
  /** Exactly what the couple chose to disclose; empty while it's hidden. */
  addressText: string;
}) {
  const { locale } = useLocale();
  const fr = locale === "fr";

  const schedule = [
    { time: "16:00", title: fr ? "Arrivée des invités" : "Guest arrival", note: "Welcome drinks & premium seating" },
    { time: "16:30", title: fr ? "La cérémonie" : "The ceremony", note: "In the beautiful meadow garden" },
    { time: "17:30", title: fr ? "Cocktail & dîner" : "Cocktails & dining", note: "Local wines & seasonal organic banquet" },
  ];

  return (
    <>
      <SectionHead
        title={fr ? "Infos pratiques" : "The details"}
        lead={
          fr
            ? "Toutes les adresses recommandées et le planning officiel du mariage."
            : "The venue, the schedule of the day and where to stay."
        }
      />

      <article className="gh-card gh-card--arch gh-venue">
        <p className="gh-kicker">{fr ? "Le lieu" : "The venue"}</p>
        {venueName ? <h3 className="gh-caps">{venueName}</h3> : null}
        {addressText ? (
          <>
            <p className="gh-sub">{addressText}</p>
            <a
              className="gh-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fr ? "Ouvrir dans Google Maps" : "Open in Google Maps"} →
            </a>
          </>
        ) : (
          <p className="gh-sub">
            {fr
              ? "L'adresse complète sera communiquée prochainement."
              : "The full address will be shared closer to the date."}
          </p>
        )}

        <div className="gh-rule" />

        <p className="gh-kicker">{fr ? "Le déroulé" : "The day"}</p>
        <ol className="gh-timeline">
          {schedule.map((item) => (
            <li key={item.time}>
              <span className="gh-time">{item.time}</span>
              <span className="gh-what">{item.title}</span>
              <span className="gh-note">{item.note}</span>
            </li>
          ))}
        </ol>
      </article>

      <h3 className="gh-subhead">{fr ? "Hébergements conseillés" : "Where to stay"}</h3>
      <div className="gh-stays">
        {STAYS.map((stay) => (
          <article key={stay.name} className="gh-stay">
            <p className="gh-kicker">{stay.badge}</p>
            <h4 className="gh-stay-name">{stay.name}</h4>
            <p className="gh-stay-meta">
              {stay.distance} · {stay.price} · {stay.rating}
            </p>
            <p className="gh-stay-desc">{stay.desc}</p>
            <a className="gh-link" href={stay.url} target="_blank" rel="noopener noreferrer">
              {fr ? "Visiter le site" : "Visit website"} →
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
