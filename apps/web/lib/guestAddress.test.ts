import { describe, expect, it } from "vitest";
import { formatGuestAddress, guestPlaceFields } from "./guestAddress";

/** Whatever the couple has chosen to disclose, and nothing more. */

const address = {
  line: "12 Rue des Oliviers",
  postal_code: "13530",
  city: "Trets",
  area: "Provence",
  country: "France",
};

describe("formatGuestAddress", () => {
  it("gives the whole address at the full tier", () => {
    expect(formatGuestAddress({ address_visibility: "full", address })).toBe(
      "12 Rue des Oliviers, Trets (13530), France",
    );
  });

  it("gives no street at the partial tier", () => {
    expect(formatGuestAddress({ address_visibility: "partial", address })).toBe(
      "Trets (13530), France",
    );
  });

  it("gives only the area at the area tier", () => {
    expect(formatGuestAddress({ address_visibility: "area", address })).toBe("Provence, France");
  });

  it("gives nothing when hidden, even if the payload carries an address", () => {
    expect(formatGuestAddress({ address_visibility: "hidden", address })).toBe("");
  });

  it("gives nothing when there is no address", () => {
    expect(formatGuestAddress({ address_visibility: "full", address: null })).toBe("");
  });

  it("copes with a postal code and no city", () => {
    expect(
      formatGuestAddress({
        address_visibility: "partial",
        address: { ...address, city: null },
      }),
    ).toBe("(13530), France");
  });
});

describe("guestPlaceFields", () => {
  it("gives only the area and country at the area tier", () => {
    expect(guestPlaceFields({ address_visibility: "area", address, venue_name: "Domaine" })).toEqual({
      venue: "",
      area: "Provence",
      city: "",
      country: "France",
    });
  });

  it("gives the city, not the area, at the partial tier", () => {
    expect(guestPlaceFields({ address_visibility: "partial", address })).toEqual({
      venue: "",
      area: "",
      city: "Trets",
      country: "France",
    });
  });

  it("adds the venue name at the full tier", () => {
    expect(guestPlaceFields({ address_visibility: "full", address, venue_name: " Domaine " })).toEqual({
      venue: "Domaine",
      area: "",
      city: "Trets",
      country: "France",
    });
  });

  it("gives nothing when hidden, even if the payload carries an address", () => {
    expect(guestPlaceFields({ address_visibility: "hidden", address, venue_name: "Domaine" })).toEqual({
      venue: "",
      area: "",
      city: "",
      country: "",
    });
  });

  it("copes with no address at all", () => {
    expect(guestPlaceFields({ address_visibility: "full", address: null })).toEqual({
      venue: "",
      area: "",
      city: "",
      country: "",
    });
  });
});
