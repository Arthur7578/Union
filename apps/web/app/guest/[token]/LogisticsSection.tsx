"use client";

import { groupMomentsByDay, resolveText, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/**
 * The venue, how to get there, the weekend and where to stay — all from what
 * the couple entered: the venue and address from the wedding settings, the
 * rest from their guest page content and their stays. A part with nothing in
 * it is left out rather than shown empty.
 */
export function LogisticsSection({
  venueName,
  addressText,
  eventDate,
  content,
}: {
  venueName: string | null | undefined;
  /** Exactly what the couple chose to disclose; empty while it's hidden. */
  addressText: string;
  eventDate: string | null | undefined;
  content: GuestPageContent;
}) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);

  const ways = [
    { key: "train", label: fr ? "En train" : "By train", text: say(content.page?.travel_train) },
    { key: "plane", label: fr ? "En avion" : "By plane", text: say(content.page?.travel_plane) },
    { key: "car", label: fr ? "En voiture" : "By car", text: say(content.page?.travel_car) },
  ].filter((w): w is { key: string; label: string; text: string } => Boolean(w.text));
  const shuttle = say(content.page?.shuttle);
  const days = groupMomentsByDay(content.moments, eventDate);

  const dayTitle = (offset: number, iso: string | null) => {
    if (iso) {
      const label = new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (offset === 0) return fr ? "Le jour J" : "The day";
    if (offset === -1) return fr ? "La veille" : "The day before";
    if (offset === 1) return fr ? "Le lendemain" : "The day after";
    return offset < 0
      ? fr ? `${-offset} jours avant` : `${-offset} days before`
      : fr ? `${offset} jours après` : `${offset} days after`;
  };

  return (
    <>
      <SectionHead
        title={fr ? "Infos pratiques" : "The details"}
        lead={
          fr
            ? "Le lieu, comment venir, le programme et où dormir."
            : "The venue, getting there, the schedule and where to stay."
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

        {ways.length || shuttle ? (
          <li className="gh-card">
            <h3 className="gh-card-title">{fr ? "Venir" : "Getting there"}</h3>
            <ul className="gh-schedule gh-ways">
              {ways.map((w) => (
                <li key={w.key}>
                  <span>
                    <span className="gh-what">{w.label}</span>
                    <span className="gh-note">{w.text}</span>
                  </span>
                </li>
              ))}
              {shuttle ? (
                <li>
                  <span>
                    <span className="gh-what">{fr ? "La navette" : "The shuttle"}</span>
                    <span className="gh-note">{shuttle}</span>
                  </span>
                </li>
              ) : null}
            </ul>
          </li>
        ) : null}

        {days.map((day) => (
          <li key={day.dayOffset} className="gh-card">
            <h3 className="gh-card-title">{dayTitle(day.dayOffset, day.date)}</h3>
            <ol className="gh-schedule">
              {day.moments.map((m) => {
                const place = say(m.place);
                const note = say(m.note);
                return (
                  <li key={m.id}>
                    <span className="gh-time">{m.starts_at ?? ""}</span>
                    <span>
                      <span className="gh-what">{say(m.title)}</span>
                      {place || note ? (
                        <span className="gh-note">{[place, note].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ul>

      {content.stays.length ? (
        <>
          <h3 className="gh-subhead">{fr ? "Où dormir" : "Where to stay"}</h3>
          <ul className="gh-list">
            {content.stays.map((stay) => (
              <li key={stay.id} className="gh-card">
                <h4 className="gh-card-title">{stay.name}</h4>
                {stay.price_note ? <p className="gh-card-meta">{stay.price_note}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
