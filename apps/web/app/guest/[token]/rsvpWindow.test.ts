import { describe, expect, it } from "vitest";
import { rsvpWindowOf } from "./rsvpWindow";

const now = new Date("2026-11-09T12:00:00Z");

describe("where the RSVP stands for guests", () => {
  it("is open without dates, and between them", () => {
    expect(rsvpWindowOf({ published: true }, now)).toBe("live");
    expect(rsvpWindowOf({ published: true, opens_at: "2026-11-01T00:00:00Z", closes_at: "2027-05-12T00:00:00Z" }, now)).toBe("live");
    expect(rsvpWindowOf(null, now)).toBe("live");
  });

  it("is closed once its closing date has passed", () => {
    expect(rsvpWindowOf({ published: true, closes_at: "2026-10-28T23:00:00Z" }, now)).toBe("closed");
  });

  it("is not open yet before its opening date", () => {
    expect(rsvpWindowOf({ published: true, opens_at: "2026-12-01T00:00:00Z" }, now)).toBe("scheduled");
  });

  it("is not shown at all while unpublished, whatever its dates", () => {
    expect(rsvpWindowOf({ published: false, closes_at: "2026-10-28T23:00:00Z" }, now)).toBe("hidden");
  });
});
