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

      <ul className="gh-list">
        <li className="gh-card">
          <h3 className="gh-card-title">{fr ? "Le lieu" : "The venue"}</h3>
          {venueName ? <p className="gh-card-body">{venueName}</p> : null}
          <p className="gh-card-meta">
            {addressText ||
              (fr
                ? "L'adresse complète sera communiquée prochainement."
                : "The full address will be shared closer to the date.")}
          </p>
          {addressText ? (
            <div className="gh-card-actions">
              <a
                className="gh-link"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {fr ? "Ouvrir dans Google Maps" : "Open in Google Maps"}
              </a>
            </div>
          ) : null}
        </li>

        <li className="gh-card">
          <h3 className="gh-card-title">{fr ? "Le déroulé" : "The day"}</h3>
          <ol className="gh-schedule">
            {schedule.map((item) => (
              <li key={item.time}>
                <span className="gh-time">{item.time}</span>
                <span>
                  <span className="gh-what">{item.title}</span>
                  <span className="gh-note">{item.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </li>
      </ul>

      <h3 className="gh-subhead">{fr ? "Où dormir" : "Where to stay"}</h3>
      <ul className="gh-list">
        {STAYS.map((stay) => (
          <li key={stay.name} className="gh-card">
            <h4 className="gh-card-title">{stay.name}</h4>
            <p className="gh-card-meta">
              {stay.type} · {stay.distance} · {stay.price} · {stay.rating}
            </p>
            <p className="gh-card-body">{stay.desc}</p>
            <div className="gh-card-actions">
              <a className="gh-link" href={stay.url} target="_blank" rel="noopener noreferrer">
                {fr ? "Visiter le site" : "Visit website"}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
