"use client";

import { useEffect, useRef, useState } from "react";
import { googleCalendarUrl, momentsToIcs, type CalendarMoment } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";

/**
 * "In my calendar": the guest ticks the moments to add, then takes them to
 * Apple Calendar or Outlook (one .ics file) or to Google Calendar (one moment
 * per link, which is all Google's link accepts).
 */
export function CalendarSheet({
  moments,
  calendarName,
  labelOf,
  onClose,
}: {
  moments: CalendarMoment[];
  calendarName: string;
  /** The line under each moment's title: its day and hour. */
  labelOf: (m: CalendarMoment) => string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const copy = t.weddingPage;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(moments.map((m) => m.id)));
  const sheetRef = useRef<HTMLDivElement>(null);
  const chosen = moments.filter((m) => picked.has(m.id));
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus moves into the sheet, Escape closes it, and focus goes back to
  // whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  const downloadIcs = () => {
    const blob = new Blob([momentsToIcs(chosen, new Date(), calendarName)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mariage.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="wp-scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className="wp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-cal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="wp-grab" aria-hidden="true" />
        <h3 id="wp-cal-title" className="wp-sheet-title">
          {copy.calendarTitle}
        </h3>
        <p className="wp-sheet-lead">{copy.calendarLead}</p>
        <ul className="wp-cal-list">
          {moments.map((m) => (
            <li key={m.id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.has(m.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(m.id);
                      else next.delete(m.id);
                      return next;
                    })
                  }
                />
                <span>
                  {m.title}
                  <small>{labelOf(m)}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="wp-sheet-actions">
          <button type="button" className="gh-btn" disabled={chosen.length === 0} onClick={downloadIcs}>
            {copy.calendarIcs}
          </button>
          {chosen.length === 1 ? (
            <a className="gh-btn gh-btn--ghost" href={googleCalendarUrl(chosen[0])} target="_blank" rel="noopener noreferrer">
              {copy.calendarGoogle}
            </a>
          ) : (
            <button type="button" className="gh-btn gh-btn--ghost" disabled aria-describedby="wp-cal-google-note">
              {copy.calendarGoogle}
            </button>
          )}
          <p id="wp-cal-google-note" className="wp-sheet-note" aria-live="polite">
            {chosen.length === 0 ? copy.calendarNone : chosen.length > 1 ? copy.calendarGoogleOne : ""}
          </p>
        </div>
        <button type="button" className="wp-sheet-close" aria-label={copy.close} onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
