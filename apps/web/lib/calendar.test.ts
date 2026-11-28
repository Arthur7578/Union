import { describe, expect, it } from "vitest";
import { googleCalendarUrl, momentsToIcs } from "@union/shared";

const stamp = new Date("2026-11-07T10:00:00Z");

describe("calendar file for the weekend's moments", () => {
  it("writes a timed moment as a one-hour floating event", () => {
    const ics = momentsToIcs(
      [{ id: "m1", date: "2027-06-12", startsAt: "16:30", title: "Cérémonie", location: "Sous les oliviers" }],
      stamp,
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20270612T163000\r\n");
    expect(ics).toContain("DTEND:20270612T173000\r\n");
    expect(ics).toContain("SUMMARY:Cérémonie\r\n");
    expect(ics).toContain("LOCATION:Sous les oliviers\r\n");
    expect(ics).toContain("UID:m1@union-wedding-page\r\n");
    expect(ics).toContain("DTSTAMP:20261107T100000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("writes a moment with no hour as an all-day event", () => {
    const ics = momentsToIcs([{ id: "m2", date: "2027-06-13", startsAt: null, title: "Brunch" }], stamp);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270613\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270614\r\n");
  });

  it("ends a late moment on the next day", () => {
    const ics = momentsToIcs([{ id: "m3", date: "2027-06-12", startsAt: "23:30", title: "Feu d'artifice" }], stamp);
    expect(ics).toContain("DTEND:20270613T003000\r\n");
  });

  it("escapes commas, semicolons and line breaks, and folds long lines", () => {
    const ics = momentsToIcs(
      [{ id: "m4", date: "2027-06-12", startsAt: "18:00", title: "Cocktail, dîner; soirée", description: "Ligne 1\nLigne 2 ".repeat(8) }],
      stamp,
    );
    expect(ics).toContain("SUMMARY:Cocktail\\, dîner\\; soirée\r\n");
    expect(ics).toContain("\\n");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("holds every moment given, in one file", () => {
    const ics = momentsToIcs(
      [
        { id: "a", date: "2027-06-11", startsAt: "19:30", title: "Dîner" },
        { id: "b", date: "2027-06-12", startsAt: "16:30", title: "Cérémonie" },
      ],
      stamp,
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("Google Calendar link", () => {
  it("carries the title, the span and the place of one moment", () => {
    const url = new URL(googleCalendarUrl({ id: "m1", date: "2027-06-12", startsAt: "16:30", title: "Cérémonie", location: "Le Mas" }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Cérémonie");
    expect(url.searchParams.get("dates")).toBe("20270612T163000/20270612T173000");
    expect(url.searchParams.get("location")).toBe("Le Mas");
  });

  it("uses all-day dates for a moment with no hour", () => {
    const url = new URL(googleCalendarUrl({ id: "m2", date: "2027-06-13", startsAt: null, title: "Brunch" }));
    expect(url.searchParams.get("dates")).toBe("20270613/20270614");
  });
});
