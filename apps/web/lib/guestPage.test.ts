import { describe, expect, it } from "vitest";
import {
  EMPTY_GUEST_PAGE,
  groupMomentsByDay,
  momentDate,
  paragraphs,
  parseGuestPage,
  suggestedChildrenAnswer,
  suggestedContactAnswer,
} from "@union/shared";

describe("momentDate", () => {
  it("places a moment relative to the wedding day", () => {
    expect(momentDate("2027-06-12", -1)).toBe("2027-06-11");
    expect(momentDate("2027-06-12", 0)).toBe("2027-06-12");
    expect(momentDate("2027-06-12", 1)).toBe("2027-06-13");
  });

  it("crosses month and year ends", () => {
    expect(momentDate("2027-07-01", -1)).toBe("2027-06-30");
    expect(momentDate("2027-12-31", 1)).toBe("2028-01-01");
    expect(momentDate("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("has no date while the wedding has none", () => {
    expect(momentDate(null, 0)).toBeNull();
    expect(momentDate("", 0)).toBeNull();
    expect(momentDate("not a date", 0)).toBeNull();
  });
});

describe("groupMomentsByDay", () => {
  const m = (id: string, day_offset: number, starts_at: string | null) => ({ id, day_offset, starts_at });

  it("orders days, then moments with no hour first, then by time", () => {
    const days = groupMomentsByDay(
      [m("brunch", 1, "11:00"), m("dinner", 0, "20:00"), m("ceremony", 0, "16:30"), m("all-day", 0, null), m("welcome", -1, "19:30")],
      "2027-06-12",
    );
    expect(days.map((d) => [d.dayOffset, d.date])).toEqual([
      [-1, "2027-06-11"],
      [0, "2027-06-12"],
      [1, "2027-06-13"],
    ]);
    expect(days[1].moments.map((x) => x.id)).toEqual(["all-day", "ceremony", "dinner"]);
  });

  it("returns nothing for no moments", () => {
    expect(groupMomentsByDay([], "2027-06-12")).toEqual([]);
  });
});

describe("parseGuestPage", () => {
  it("reads what get_guest_page returns", () => {
    const page = parseGuestPage({
      page: {
        welcome: { fr: "Il y a huit ans…" },
        travel_train: null,
        travel_plane: null,
        travel_car: null,
        shuttle: null,
        dress_code: { fr: "Chic champêtre" },
        dress_text: null,
        dress_note: null,
        palette: [{ color: "#A4AE8F", name: { fr: "Sauge" } }],
      },
      moments: [{ id: "a", day_offset: 0, starts_at: "16:30", title: { fr: "Cérémonie" }, place: null, note: null }],
      faq: [{ id: "q", question: { fr: "Enfants ?" }, answer: { fr: "Oui" } }],
      stays: [{ id: "s", name: "Hôtel", price_note: "" }],
    });
    expect(page.page?.dress_code).toEqual({ fr: "Chic champêtre" });
    expect(page.page?.palette).toEqual([{ color: "#A4AE8F", name: { fr: "Sauge" } }]);
    expect(page.moments[0].starts_at).toBe("16:30");
    expect(page.faq).toHaveLength(1);
    // A blank price line is no price line.
    expect(page.stays).toEqual([{ id: "s", name: "Hôtel", price_note: null }]);
  });

  it("never throws on missing or malformed data", () => {
    expect(parseGuestPage(null)).toEqual(EMPTY_GUEST_PAGE);
    expect(parseGuestPage("oops")).toEqual(EMPTY_GUEST_PAGE);
    const page = parseGuestPage({
      page: { palette: [{ color: "olive" }, "x", { color: "#000000" }] },
      moments: [{ id: 3 }, { id: "ok", day_offset: 1 }],
      faq: "nope",
      stays: [{ name: "No id" }],
    });
    expect(page.page?.palette).toEqual([{ color: "#000000" }]);
    expect(page.moments.map((x) => x.id)).toEqual(["ok"]);
    expect(page.faq).toEqual([]);
    expect(page.stays).toEqual([]);
  });
});

describe("paragraphs", () => {
  it("splits the couple's word on blank lines", () => {
    expect(paragraphs("Un.\n\nDeux,\nsuite.\n \n\nTrois.")).toEqual(["Un.", "Deux,\nsuite.", "Trois."]);
    expect(paragraphs(undefined)).toEqual([]);
  });
});

describe("suggested answers", () => {
  it("answers the children question from the guest permissions", () => {
    expect(suggestedChildrenAnswer({ allow_guests_add_children: false, max_children_per_guest: null }).fr).toBe(
      "Les enfants attendus sont ceux nommés sur votre invitation.",
    );
    expect(suggestedChildrenAnswer({ allow_guests_add_children: true, max_children_per_guest: 2 }).en).toBe(
      "Yes, gladly. You can add up to 2 children when you reply.",
    );
    expect(suggestedChildrenAnswer({ allow_guests_add_children: true, max_children_per_guest: 1 }).fr).toBe(
      "Oui, avec joie. Vous pouvez ajouter jusqu’à 1 enfant en répondant.",
    );
    expect(suggestedChildrenAnswer({ allow_guests_add_children: true, max_children_per_guest: null }).en).toBe(
      "Yes, gladly. You can add them when you reply.",
    );
  });

  it("answers the contact question from a profile, or not at all", () => {
    expect(suggestedContactAnswer({ full_name: "Léa Martin", phone: "06 12 34 56 78" })).toEqual({
      fr: "Léa Martin · 06 12 34 56 78",
      en: "Léa Martin · 06 12 34 56 78",
    });
    expect(suggestedContactAnswer({ full_name: " ", phone: null })).toBeNull();
  });
});
