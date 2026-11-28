"use client";

import { resolveText, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/**
 * Le lieu et venir: the venue and its address as the couple chose to
 * disclose them (wedding settings), how to get there, the shuttle (which the
 * server sends only to a household that said yes) and where to stay (the
 * couple's stays). A block with nothing in it is left out.
 */
export function VenueSection({
  venueName,
  addressText,
  content,
}: {
  venueName: string | null | undefined;
  /** Exactly what the couple chose to disclose; empty while it's hidden. */
  addressText: string;
  content: GuestPageContent;
}) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);

  const ways = [
    { key: "train", label: copy.byTrain, text: say(content.page?.travel_train) },
    { key: "plane", label: copy.byPlane, text: say(content.page?.travel_plane) },
    { key: "car", label: copy.byCar, text: say(content.page?.travel_car) },
  ].filter((w): w is { key: string; label: string; text: string } => Boolean(w.text));
  const shuttle = say(content.page?.shuttle);
  const query = encodeURIComponent([venueName, addressText].filter(Boolean).join(", "));

  return (
    <>
      <SectionHead title={copy.venueTitle} lead={copy.venueLead} />

      <div className="wp-venue">
        {venueName ? <h3 className="wp-venue-name">{venueName}</h3> : null}
        <p className="wp-venue-address">{addressText || copy.addressSoon}</p>
        {addressText ? (
          <div className="wp-maps">
            <a href={`https://maps.apple.com/?q=${query}`} target="_blank" rel="noopener noreferrer">
              {copy.appleMaps}
            </a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer">
              {copy.googleMaps}
            </a>
          </div>
        ) : null}
      </div>

      {shuttle ? (
        <div className="wp-shuttle">
          <h3 className="wp-small">{copy.shuttle}</h3>
          <p>{shuttle}</p>
          <p className="wp-note">{copy.shuttleNote}</p>
        </div>
      ) : null}

      {ways.length ? (
        <>
          <h3 className="wp-small">{copy.gettingThere}</h3>
          <ul className="wp-ways">
            {ways.map((w) => (
              <li key={w.key}>
                <b>{w.label}</b>
                <span>{w.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {content.stays.length ? (
        <>
          <h3 className="wp-small">{copy.stays}</h3>
          <ul className="wp-ways">
            {content.stays.map((stay) => (
              <li key={stay.id}>
                <h4>{stay.name}</h4>
                {stay.price_note ? <span>{stay.price_note}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
