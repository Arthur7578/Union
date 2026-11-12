import { afterEach, describe, expect, it } from "vitest";
import { closingDay, fromDateInput, shortDate, toDateInput } from "./dateLabels";

/**
 * A form's dates are days in Paris time, wherever the code runs: the server
 * (UTC), the organiser's browser, a guest's phone abroad. The closing day is
 * included: guests can reply until its last second.
 */
const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});
const zones = ["UTC", "Europe/Paris", "America/Los_Angeles", "Asia/Tokyo"];

describe("a form's dates in a date field", () => {
  it("opens at the start of the day picked, Paris time, in winter and in summer", () => {
    expect(fromDateInput("2027-01-10", "opens")).toBe("2027-01-09T23:00:00.000Z");
    expect(fromDateInput("2027-05-12", "opens")).toBe("2027-05-11T22:00:00.000Z");
  });

  it("closes at the end of the day picked: that day is included", () => {
    expect(fromDateInput("2027-05-12", "closes")).toBe("2027-05-12T21:59:59.000Z");
    expect(fromDateInput("2026-10-29", "closes")).toBe("2026-10-29T22:59:59.000Z");
  });

  it("shows the day picked again, whatever the machine's time zone, however often it is saved", () => {
    for (const tz of zones) {
      process.env.TZ = tz;
      for (const kind of ["opens", "closes"] as const) {
        let value = "2027-05-12";
        for (let i = 0; i < 3; i++) value = toDateInput(fromDateInput(value, kind), kind);
        expect(value, `${kind} in ${tz}`).toBe("2027-05-12");
      }
    }
  });

  it("reads a closing saved the old way (the start of a day) as its real last day, the day before", () => {
    // Picked "29 October" before this change: stored as 29 October, 00:00 in Paris.
    expect(toDateInput("2026-10-28T23:00:00.000Z", "closes")).toBe("2026-10-28");
  });

  it("leaves an empty field empty", () => {
    expect(toDateInput(null, "opens")).toBe("");
    expect(fromDateInput("", "closes")).toBeNull();
  });
});

describe("the dates guests and the couple read", () => {
  it("names the same closing day on the server and on any phone", () => {
    const closes = fromDateInput("2027-05-12", "closes");
    for (const tz of zones) {
      process.env.TZ = tz;
      expect(closingDay(closes, "fr"), tz).toBe("12 mai");
      expect(closingDay(closes, "en"), tz).toBe("May 12");
    }
  });

  it("names the last day replies were taken for a closing saved the old way", () => {
    for (const tz of zones) {
      process.env.TZ = tz;
      expect(closingDay("2026-10-28T23:00:00.000Z", "fr"), tz).toBe("28 octobre");
    }
  });

  it("names the same opening day everywhere", () => {
    const opens = fromDateInput("2027-01-10", "opens");
    for (const tz of zones) {
      process.env.TZ = tz;
      expect(shortDate(opens, "fr"), tz).toBe("10 janvier");
    }
  });

  it("has nothing to say without a date", () => {
    expect(closingDay(null, "fr")).toBeNull();
    expect(shortDate(undefined, "fr")).toBeNull();
  });
});
