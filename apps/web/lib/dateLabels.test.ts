import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromDateInput, toDateInput } from "./dateLabels";

/** A form's dates as the organiser picks them, in Paris, east of UTC. */
const original = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  process.env.TZ = original;
});

describe("a form's dates in a date field", () => {
  it("shows the day the organiser picked, not the UTC day before it", () => {
    // Picked "29 October" in Paris: stored as 28 October, 23:00 UTC.
    expect(fromDateInput("2026-10-29")).toBe("2026-10-28T23:00:00.000Z");
    expect(toDateInput("2026-10-28T23:00:00.000Z")).toBe("2026-10-29");
  });

  it("keeps the same day however many times it is saved", () => {
    let value = "2027-05-12";
    for (let i = 0; i < 3; i++) value = toDateInput(fromDateInput(value));
    expect(value).toBe("2027-05-12");
  });

  it("leaves an empty field empty", () => {
    expect(toDateInput(null)).toBe("");
    expect(fromDateInput("")).toBeNull();
  });
});
