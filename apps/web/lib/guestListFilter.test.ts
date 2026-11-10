import { describe, expect, it } from "vitest";
import { filterGuests, latestReplies, parseGuestStatusFilter } from "@union/shared";

const guests = [
  { first_name: "Léa", last_name: "Martin", email: "lea@x.fr", guest_group: "Friends", rsvps: { status: "attending", responded_at: "2026-10-02T10:00:00Z" } },
  { first_name: "Hugo", last_name: "Bernard", email: null, guest_group: "Family", rsvps: { status: "declined", responded_at: "2026-10-05T10:00:00Z" } },
  { first_name: "Inès", last_name: null, email: "ines@x.fr", rsvps: null },
  { first_name: "Sam", last_name: "Roy", rsvps: { status: "maybe", responded_at: "2026-09-01T10:00:00Z" } },
  { first_name: "Noé", last_name: "Petit", rsvps: { status: "pending", responded_at: null } },
];

describe("parseGuestStatusFilter", () => {
  it("keeps a known filter and turns anything else into all", () => {
    expect(parseGuestStatusFilter("waiting")).toBe("waiting");
    expect(parseGuestStatusFilter("nope")).toBe("all");
    expect(parseGuestStatusFilter(null)).toBe("all");
  });
});

describe("filterGuests", () => {
  it("counts a guest with no RSVP row as waiting", () => {
    expect(filterGuests(guests, "waiting", "").map((g) => g.first_name)).toEqual(["Inès", "Noé"]);
  });

  it("filters by each reply", () => {
    expect(filterGuests(guests, "coming", "").map((g) => g.first_name)).toEqual(["Léa"]);
    expect(filterGuests(guests, "maybe", "").map((g) => g.first_name)).toEqual(["Sam"]);
    expect(filterGuests(guests, "declined", "").map((g) => g.first_name)).toEqual(["Hugo"]);
    expect(filterGuests(guests, "all", "")).toHaveLength(5);
  });

  it("searches name, email and group, ignoring case and accents", () => {
    expect(filterGuests(guests, "all", "LEA").map((g) => g.first_name)).toEqual(["Léa"]);
    expect(filterGuests(guests, "all", "family").map((g) => g.first_name)).toEqual(["Hugo"]);
    expect(filterGuests(guests, "all", "ines@").map((g) => g.first_name)).toEqual(["Inès"]);
  });

  it("applies the status and the search together", () => {
    expect(filterGuests(guests, "waiting", "lea")).toEqual([]);
  });
});

describe("latestReplies", () => {
  it("lists answered guests newest first, skipping the ones still waiting", () => {
    expect(latestReplies(guests, 2).map((g) => g.first_name)).toEqual(["Hugo", "Léa"]);
    expect(latestReplies(guests, 10)).toHaveLength(3);
  });
});
