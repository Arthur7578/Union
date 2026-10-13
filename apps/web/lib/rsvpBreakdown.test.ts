import { describe, expect, it } from "vitest";
import type { GuestWithRsvp } from "./data";
import { breakdownFor } from "./rsvpBreakdown";

const guest = (status: "pending" | "attending" | "maybe" | "declined" | null) =>
  ({ rsvps: status === null ? null : { status } }) as unknown as GuestWithRsvp;

describe("breakdownFor", () => {
  it("counts each reply on its own, maybes included", () => {
    expect(
      breakdownFor([
        guest("attending"),
        guest("attending"),
        guest("maybe"),
        guest("declined"),
        guest("pending"),
      ]),
    ).toEqual({ attending: 2, maybe: 1, declined: 1, pending: 1 });
  });

  it("counts a guest with no reply on file as pending, not as an answer", () => {
    expect(breakdownFor([guest(null), guest("maybe")])).toEqual({
      attending: 0,
      maybe: 1,
      declined: 0,
      pending: 1,
    });
  });

  it("is all zeros for an empty group", () => {
    expect(breakdownFor([])).toEqual({ attending: 0, maybe: 0, declined: 0, pending: 0 });
  });
});
