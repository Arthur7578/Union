import { describe, expect, it } from "vitest";
import {
  fairePartFields,
  fairePartLines,
  renderTemplate,
  slotTemplate,
  unknownFields,
} from "./fairePart";

const ctx = {
  guestFirstName: "Léa",
  partnerOne: "Maya",
  partnerTwo: "Daniel",
  eventDate: "2027-06-11",
  eventEndDate: "2027-06-13",
  place: { area: "Provence", country: "France" },
};
const fr = fairePartFields(ctx, "fr");

describe("fairePartFields", () => {
  it("writes every field for the guest's language", () => {
    expect(fr).toMatchObject({
      guest_first_name: "Léa",
      couple: "Maya & Daniel",
      dates: "11 — 13 juin 2027",
      dates_spoken: "du 11 au 13 juin 2027",
      duration: "trois jours",
      area: "Provence",
      city: "",
    });
    expect(fairePartFields(ctx, "en")).toMatchObject({ dates_spoken: "from June 11 to 13, 2027", duration: "three days" });
  });

  it("always has a duration, even with no date", () => {
    expect(fairePartFields({}, "fr").duration).toBe("des moments");
    expect(fairePartFields({}, "en").duration).toBe("moments");
  });
});

describe("renderTemplate", () => {
  it("fills fields", () => {
    expect(renderTemplate("Pour {{guest_first_name}} et {{couple}}", fr)).toBe("Pour Léa et Maya & Daniel");
  });

  it("takes the first field that has a value", () => {
    expect(renderTemplate("{{city|area}}", fr)).toBe("Provence");
    expect(renderTemplate("{{area|city}}", { ...fr, area: "", city: "Trets" })).toBe("Trets");
  });

  it("drops the whole slot when a field outside brackets is empty", () => {
    expect(renderTemplate("{{guest_first_name}},", { ...fr, guest_first_name: "" })).toBe("");
    expect(renderTemplate("En {{city}}", fr)).toBe("");
  });

  it("drops only an optional part when a field inside it is empty", () => {
    expect(renderTemplate("Rendez-vous[ à {{city}}][ en {{area}}]", fr)).toBe("Rendez-vous en Provence");
  });

  it("is an empty slot when nothing is left", () => {
    expect(renderTemplate("[En {{area}}][À {{city}}]", { ...fr, area: "" })).toBe("");
  });

  it("never reads guest data as template syntax", () => {
    const sneaky = { ...fr, guest_first_name: "{{couple}} [x]" };
    expect(renderTemplate("{{guest_first_name}},", sneaky)).toBe("{{couple}} [x],");
  });

  it("treats an unknown field as empty", () => {
    expect(renderTemplate("Hello {{nope}}", fr)).toBe("");
    expect(renderTemplate("Hello[ {{nope}}]", fr)).toBe("Hello");
  });

  it("tidies spaces", () => {
    expect(renderTemplate("a   b ,c", fr)).toBe("a b,c");
  });
});

describe("unknownFields", () => {
  it("lists names that are not fields", () => {
    expect(unknownFields("{{couple}} {{nope}} {{area|oops}} {{city}}")).toEqual(["nope", "oops"]);
  });
});

describe("the default card", () => {
  it("reads as written for a named guest with every detail", () => {
    const lines = fairePartLines(null, ctx, "fr");
    expect(lines.greeting).toBe("Léa,");
    expect(lines.front_dates).toBe("11 — 13 juin 2027");
    expect(lines.front_place).toBe("En Provence ♡");
    expect(lines.invite).toBe(
      "Nous serions très heureux de te retrouver en Provence, du 11 au 13 juin 2027, pour célébrer notre mariage et partager trois jours de fête, de joie et de beaux souvenirs.",
    );
    expect(lines.signature).toBe("Maya & Daniel");
  });

  it("falls back from the area to the city, with the right preposition", () => {
    const lines = fairePartLines(null, { ...ctx, place: { city: "Trets" } }, "fr");
    expect(lines.front_place).toBe("À Trets ♡");
    expect(lines.invite).toContain("te retrouver à Trets, du 11 au 13 juin 2027, pour");
  });

  it("never uses the country alone", () => {
    const lines = fairePartLines(null, { ...ctx, place: { country: "France" } }, "fr");
    expect(lines.front_place).toBe("");
    expect(lines.invite).toContain("te retrouver du 11 au 13 juin 2027, pour");
  });

  it("leaves out what is not known", () => {
    const lines = fairePartLines(null, { partnerOne: "Maya", partnerTwo: "Daniel" }, "fr");
    expect(lines.greeting).toBe("");
    expect(lines.front_dates).toBe("");
    expect(lines.front_place).toBe("");
    expect(lines.invite).toBe(
      "Nous serions très heureux de te retrouver pour célébrer notre mariage et partager des moments de fête, de joie et de beaux souvenirs.",
    );
  });
});

describe("the couple's wording", () => {
  const copy = { greeting: { fr: "Cher {{guest_first_name}},", en: "" }, closing: { en: "Love," } };

  it("replaces the default in its own language only", () => {
    expect(slotTemplate(copy, "greeting", "fr")).toBe("Cher {{guest_first_name}},");
    expect(fairePartLines(copy, ctx, "fr").greeting).toBe("Cher Léa,");
    // Nothing written for English: the default, not the French.
    expect(fairePartLines(copy, ctx, "en").greeting).toBe("Léa,");
    // And nothing written for French here: the default, not the English.
    expect(fairePartLines(copy, ctx, "fr").closing).toBe("Avec toute notre affection,");
    expect(fairePartLines(copy, ctx, "en").closing).toBe("Love,");
  });

  it("uses the default for a blank template", () => {
    expect(fairePartLines({ moments: { fr: "   " } }, ctx, "fr").moments).toMatch(/^Il y a des moments/);
  });
});
