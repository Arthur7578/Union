import { describe, expect, it } from "vitest";
import { guestAttention } from "@union/shared";

const now = new Date("2026-11-11T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("guestAttention", () => {
  it("asks for nothing when every guest has answered and nothing is pending", () => {
    const guests = [{ email: "a@x", rsvps: { status: "attending" } }, { rsvps: { status: "declined" } }];
    expect(guestAttention(guests, { duplicateGroups: 0, seatingTables: 0, now })).toEqual([]);
  });

  it("puts the nudge first and the waiting guests without email next", () => {
    const guests = [
      { email: "a@x", rsvps: null },
      { email: "b@x", rsvps: { status: "pending" } },
      { email: null, rsvps: null },
    ];
    expect(guestAttention(guests, { duplicateGroups: 0, seatingTables: 0, now })).toEqual([
      { kind: "nudge", waiting: 3, withEmail: 2, recentDays: null },
      { kind: "noEmail", count: 1 },
    ]);
  });

  it("calms the nudge when everyone reachable was nudged this week", () => {
    const guests = [
      { email: "a@x", rsvp_reminder_sent_at: daysAgo(2) },
      { email: "b@x", rsvp_reminder_sent_at: daysAgo(5) },
      { rsvps: { status: "maybe" } },
    ];
    const items = guestAttention(guests, { duplicateGroups: 1, seatingTables: 0, now });
    expect(items.map((i) => i.kind)).toEqual(["duplicates", "nudge", "maybe"]);
    expect(items[1]).toMatchObject({ recentDays: 2 });
  });

  it("presses again once one of them was never nudged or the nudge is a week old", () => {
    const old = [{ email: "a@x", rsvp_reminder_sent_at: daysAgo(8) }];
    expect(guestAttention(old, { duplicateGroups: 0, seatingTables: 0, now })[0]).toMatchObject({ recentDays: null });
    const mixed = [{ email: "a@x", rsvp_reminder_sent_at: daysAgo(1) }, { email: "b@x" }];
    expect(guestAttention(mixed, { duplicateGroups: 0, seatingTables: 0, now })[0]).toMatchObject({ recentDays: null });
  });

  it("flags coming guests without a seat only once the plan has tables", () => {
    const guests = [{ rsvps: { status: "attending" } }, { rsvps: { status: "attending" }, seating_table_id: "t1" }];
    expect(guestAttention(guests, { duplicateGroups: 0, seatingTables: 0, now })).toEqual([]);
    expect(guestAttention(guests, { duplicateGroups: 0, seatingTables: 2, now })).toEqual([{ kind: "unseated", count: 1 }]);
  });
});
