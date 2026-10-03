import { describe, expect, it } from "vitest";
import {
  isRsvpAnswerAllowed,
  mayAttend,
  rollUpRsvps,
  rsvpAnswers,
} from "@union/shared";

describe("which answers an RSVP offers", () => {
  it("offers the two answers guests had before 'maybe' existed when it's off", () => {
    // This is the whole compatibility claim of the feature: a couple who
    // never touches the switch sees the RSVP they already had.
    expect(rsvpAnswers(false)).toEqual(["attending", "declined"]);
  });

  it("puts 'maybe' between the other two when it's on", () => {
    // Order matters: "maybe" is a point between yes and no, and reading it
    // last makes it look like an afterthought rather than a real answer.
    expect(rsvpAnswers(true)).toEqual(["attending", "maybe", "declined"]);
  });

  it("refuses 'maybe' while the option is off, and nothing else changes", () => {
    expect(isRsvpAnswerAllowed("maybe", false)).toBe(false);
    expect(isRsvpAnswerAllowed("maybe", true)).toBe(true);
    for (const allow of [false, true]) {
      expect(isRsvpAnswerAllowed("attending", allow)).toBe(true);
      expect(isRsvpAnswerAllowed("declined", allow)).toBe(true);
      // 'pending' is the absence of an answer, never one of them — a guest
      // who has touched nothing must not be submittable.
      expect(isRsvpAnswerAllowed("pending", allow)).toBe(false);
      expect(isRsvpAnswerAllowed("", allow)).toBe(false);
      expect(isRsvpAnswerAllowed(null, allow)).toBe(false);
      expect(isRsvpAnswerAllowed(undefined, allow)).toBe(false);
    }
  });

  it("treats a maybe as someone worth asking the follow-up questions", () => {
    // Dietary notes and companion replies are gated on this. Asking a maybe
    // now beats a second round once they firm up.
    expect(mayAttend("attending")).toBe(true);
    expect(mayAttend("maybe")).toBe(true);
    expect(mayAttend("declined")).toBe(false);
    expect(mayAttend("pending")).toBe(false);
    expect(mayAttend(null)).toBe(false);
  });
});

describe("rolling a guest list up for organisers", () => {
  it("keeps the headcount firm and reports the ceiling separately", () => {
    const rollup = rollUpRsvps([
      "attending",
      "attending",
      "maybe",
      "maybe",
      "maybe",
      "declined",
      "pending",
    ]);

    expect(rollup).toEqual({
      invited: 7,
      coming: 2,
      maybe: 3,
      declined: 1,
      waiting: 1,
      // headcount stays what every screen meant by it before 'maybe' existed,
      // so nothing silently starts counting unsure guests as confirmed.
      headcount: 2,
      headcountMax: 5,
    });
  });

  it("collapses to a single number when nobody answered maybe", () => {
    const rollup = rollUpRsvps(["attending", "attending", "declined"]);
    expect(rollup.headcount).toBe(2);
    expect(rollup.headcountMax).toBe(2);
    expect(rollup.maybe).toBe(0);
  });

  it("counts a missing rsvp row as still waiting, not as an answer", () => {
    const rollup = rollUpRsvps([null, undefined, "pending"]);
    expect(rollup.waiting).toBe(3);
    expect(rollup.invited).toBe(3);
    expect(rollup.headcountMax).toBe(0);
  });

  it("counts nothing for an empty list rather than dividing by it", () => {
    expect(rollUpRsvps([])).toEqual({
      invited: 0,
      coming: 0,
      maybe: 0,
      declined: 0,
      waiting: 0,
      headcount: 0,
      headcountMax: 0,
    });
  });
});
