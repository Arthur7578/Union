import { describe, expect, it } from "vitest";
import { rsvpCardLine } from "@union/shared";

/**
 * The one-line answer on the hub's RSVP card. A guest invited alone reads
 * their own answer, not "Their name: answer" (issue #85); a household keeps
 * one name per person so it is clear who each answer is for.
 */

const fr = { attending: "Présent", maybe: "Peut-être", declined: "Absent" } as const;
const en = { attending: "Attending", maybe: "Not sure yet", declined: "Declined" } as const;
const labelsOf = (l: Record<"attending" | "maybe" | "declined", string>) => (s: keyof typeof l) => l[s];

describe("the RSVP card's line for a guest invited alone", () => {
  it("is the answer alone, with no name and no colon", () => {
    for (const status of ["attending", "maybe", "declined"] as const) {
      expect(rsvpCardLine({ guest: { name: "Léa", status }, companions: [], label: labelsOf(fr), locale: "fr" })).toBe(
        fr[status],
      );
      expect(rsvpCardLine({ guest: { name: "Léa", status }, companions: [], label: labelsOf(en), locale: "en" })).toBe(
        en[status],
      );
    }
  });

  it("is the couple's own wording, never replaced", () => {
    const label = () => "Je ne pourrai pas venir";
    expect(rsvpCardLine({ guest: { name: "Yyyy", status: "declined" }, companions: [], label, locale: "fr" })).toBe(
      "Je ne pourrai pas venir",
    );
  });

  it("does not show a stray colon for a guest with no first name", () => {
    expect(rsvpCardLine({ guest: { name: "", status: "attending" }, companions: [], label: labelsOf(fr), locale: "fr" })).toBe(
      "Présent",
    );
  });
});

describe("the RSVP card's line for a household", () => {
  const guinevere = (status: "pending" | "attending" | "maybe" | "declined") => ({ name: "Guinevere", status });

  it("names each person who has been answered for, as before", () => {
    expect(
      rsvpCardLine({
        guest: { name: "Arthur", status: "attending" },
        companions: [guinevere("declined")],
        label: labelsOf(fr),
        locale: "fr",
      }),
    ).toBe("Arthur : Présent, Guinevere : Absent");
    expect(
      rsvpCardLine({
        guest: { name: "Arthur", status: "attending" },
        companions: [guinevere("declined")],
        label: labelsOf(en),
        locale: "en",
      }),
    ).toBe("Arthur: Attending, Guinevere: Declined");
  });

  it("keeps the guest's name when a companion has not been answered for yet", () => {
    // "Solo" means no companions on the invitation, not "nobody else replied":
    // the name says the answer is only for this guest so far.
    expect(
      rsvpCardLine({
        guest: { name: "Arthur", status: "attending" },
        companions: [guinevere("pending")],
        label: labelsOf(fr),
        locale: "fr",
      }),
    ).toBe("Arthur : Présent");
  });

  it("uses the couple's wording for every person", () => {
    const couple = { attending: "Je serai là", maybe: "Peut-être", declined: "Je ne pourrai pas venir" };
    expect(
      rsvpCardLine({
        guest: { name: "Arthur", status: "declined" },
        companions: [guinevere("attending")],
        label: labelsOf(couple),
        locale: "fr",
      }),
    ).toBe("Arthur : Je ne pourrai pas venir, Guinevere : Je serai là");
  });

  it("lists a large household in full, guest first then companions in the order given", () => {
    const companions = Array.from({ length: 11 }, (_, i) => ({ name: `C${i + 1}`, status: "attending" as const }));
    const line = rsvpCardLine({ guest: { name: "Arthur", status: "attending" }, companions, label: labelsOf(en), locale: "en" });
    expect(line).toBe(["Arthur", ...companions.map((c) => c.name)].map((n) => `${n}: Attending`).join(", "));
  });
});
