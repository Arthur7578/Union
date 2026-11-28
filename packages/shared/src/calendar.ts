/**
 * "Add to my calendar" for the moments of the wedding weekend: one .ics file
 * (Apple Calendar, Outlook, and Google once imported) for any number of
 * moments, or a Google Calendar link for one.
 *
 * Times are floating local times: the couple writes "16:30" for the venue's
 * own clock and the app stores no time zone, so the event is placed at 16:30
 * on whatever calendar opens it. That is right for guests in the venue's time
 * zone, which is nearly everyone; a guest abroad sees the venue's clock time.
 * A moment with no set hour becomes an all-day event. A moment with an hour
 * lasts one hour: the couple doesn't say how long, and a zero-length event
 * hides in most calendars.
 *
 * Kept free of anything web-specific so the native app can reuse it.
 */

export type CalendarMoment = {
  /** Stable id, used as the event's UID so a second import updates it. */
  id: string;
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:MM", or null for an all-day moment. */
  startsAt: string | null;
  title: string;
  location?: string | null;
  description?: string | null;
};

/** How long a moment with an hour lasts in the calendar. */
const DURATION_MINUTES = 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" + days, "YYYYMMDD", in UTC so no time zone shifts the day. */
function compactDate(date: string, plusDays = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + plusDays));
  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
}

/** Start and end, as floating "YYYYMMDDTHHMMSS", or all-day "YYYYMMDD". */
function span(m: CalendarMoment): { allDay: boolean; start: string; end: string } {
  if (!m.startsAt || !/^\d{2}:\d{2}$/.test(m.startsAt)) {
    return { allDay: true, start: compactDate(m.date), end: compactDate(m.date, 1) };
  }
  const [h, min] = m.startsAt.split(":").map(Number);
  const total = h * 60 + min + DURATION_MINUTES;
  const endDay = Math.floor(total / 1440);
  const endMin = total % 1440;
  return {
    allDay: false,
    start: `${compactDate(m.date)}T${pad(h)}${pad(min)}00`,
    end: `${compactDate(m.date, endDay)}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`,
  };
}

/** RFC 5545 text: backslash, comma, semicolon and newlines escaped. */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are folded at 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/**
 * One calendar file holding every moment given. `stamp` is when the file is
 * made (DTSTAMP), passed in so the output is testable.
 */
export function momentsToIcs(moments: readonly CalendarMoment[], stamp: Date, calendarName?: string): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Union//Wedding page//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (calendarName) lines.push(`X-WR-CALNAME:${escapeText(calendarName)}`);
  for (const m of moments) {
    const s = span(m);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${m.id}@union-wedding-page`,
      `DTSTAMP:${dtstamp}`,
      s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
      s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
      `SUMMARY:${escapeText(m.title)}`,
    );
    if (m.location) lines.push(`LOCATION:${escapeText(m.location)}`);
    if (m.description) lines.push(`DESCRIPTION:${escapeText(m.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A Google Calendar "add event" link for one moment. */
export function googleCalendarUrl(m: CalendarMoment): string {
  const s = span(m);
  const params = new URLSearchParams({ action: "TEMPLATE", text: m.title, dates: `${s.start}/${s.end}` });
  if (m.location) params.set("location", m.location);
  if (m.description) params.set("details", m.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
