"use client";

import { useState } from "react";
import { groupMomentsByDay, resolveText, type CalendarMoment, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n";
import { CalendarSheet } from "./CalendarSheet";
import { dayLabel } from "@/lib/dateLabels";
import { SectionHead } from "./SectionHead";

type Copy = ReturnType<typeof useLocale>["t"]["weddingPage"];

/** A day's heading: its date once the wedding has one, else where it sits. */
function dayTitle(offset: number, iso: string | null, locale: Locale, copy: Copy) {
  if (iso) return dayLabel(iso, locale);
  if (offset === 0) return copy.theDay;
  if (offset === -1) return copy.dayBefore;
  if (offset === 1) return copy.dayAfter;
  return offset < 0 ? copy.daysBefore(-offset) : copy.daysAfter(offset);
}

/**
 * The weekend's moments as calendar events, in page order. Only moments with
 * a date can go to a calendar, so none until the wedding has a date.
 */
export function calendarMoments(
  content: GuestPageContent,
  eventDate: string | null | undefined,
  locale: Locale,
  venueName: string | null | undefined,
): CalendarMoment[] {
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);
  return groupMomentsByDay(content.moments, eventDate).flatMap((day) =>
    day.date
      ? day.moments.map((m) => ({
          id: m.id,
          date: day.date as string,
          startsAt: m.starts_at,
          title: say(m.title) || "",
          location: say(m.place) || venueName || null,
          description: say(m.note) || null,
        }))
      : [],
  );
}

/** Le week-end: each day and its moments, and "add to my calendar". */
export function WeekendSection({
  content,
  eventDate,
  venueName,
  calendarName,
}: {
  content: GuestPageContent;
  eventDate: string | null | undefined;
  venueName: string | null | undefined;
  calendarName: string;
}) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);
  const days = groupMomentsByDay(content.moments, eventDate);
  const forCalendar = calendarMoments(content, eventDate, locale, venueName);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <SectionHead title={copy.weekendTitle} lead={copy.weekendLead} />
      {days.map((day) => {
        const heading = dayTitle(day.dayOffset, day.date, locale, copy);
        return (
          <section key={day.dayOffset} className="wp-day" aria-label={heading}>
            <h3 className="wp-day-head">{heading}</h3>
            <ol className="wp-events">
              {day.moments.map((m) => {
                const place = say(m.place);
                const note = say(m.note);
                return (
                  <li key={m.id} className="wp-event">
                    <time>{m.starts_at ?? ""}</time>
                    <div>
                      <h4>{say(m.title)}</h4>
                      {place ? <p className="wp-event-place">{place}</p> : null}
                      {note ? <p>{note}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {forCalendar.length ? (
        <div className="wp-actions">
          <button type="button" className="gh-btn gh-btn--ghost" onClick={() => setSheetOpen(true)}>
            {copy.addToCalendar}
          </button>
        </div>
      ) : null}
      {sheetOpen ? (
        <CalendarSheet
          moments={forCalendar}
          calendarName={calendarName}
          labelOf={(m) => [dayLabel(m.date, locale), m.startsAt].filter(Boolean).join(", ")}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}
