import { describe, expect, it } from "vitest";
import { formatGuestAddress, guestZone } from "./guestAddress";

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

describe("guestZone", () => {
  it("is the couple's own phrase first, whatever the tier", () => {
    for (const tier of ["area", "partial", "full"] as const) {
      expect(guestZone({ address_visibility: tier, address, zone: " dans le Var " })).toEqual({
        kind: "phrase",
        name: "dans le Var",
      });
    }
  });

  it("ignores a blank phrase and falls back to the area, then the city", () => {
    expect(guestZone({ address_visibility: "area", address, zone: "  " })?.name).toBe("Provence");
    expect(guestZone({ address_visibility: "partial", address, zone: null })?.name).toBe("Trets");
  });

  it("is nothing when hidden, even with a phrase", () => {
    expect(guestZone({ address_visibility: "hidden", address: null, zone: "en Provence" })).toBeNull();
  });

  it("is the phrase even when no address is disclosed to build from", () => {
    expect(guestZone({ address_visibility: "area", address: null, zone: "en Provence" })?.name).toBe("en Provence");
  });

  // The RPC only sends the area at the area tier and the city at the
  // partial and full tiers; these are the payloads it produces.
  const areaTier = { ...address, line: null, postal_code: null, city: null };
  const cityTier = { ...address, area: null };

  it("is the area when the couple disclosed one", () => {
    expect(guestZone({ address_visibility: "area", address: areaTier })).toEqual({
      kind: "area",
      name: "Provence",
    });
  });

  it("falls back to the city when there is no area", () => {
    expect(guestZone({ address_visibility: "partial", address: cityTier })).toEqual({
      kind: "city",
      name: "Trets",
    });
    expect(guestZone({ address_visibility: "full", address: cityTier })).toEqual({
      kind: "city",
      name: "Trets",
    });
  });

  it("ignores a blank area", () => {
    expect(guestZone({ address_visibility: "area", address: { ...areaTier, area: "  " } })).toBeNull();
    expect(
      guestZone({ address_visibility: "partial", address: { ...cityTier, area: "  " } })?.name,
    ).toBe("Trets");
  });

  it("is never the country alone, the postal code or the street", () => {
    expect(
      guestZone({
        address_visibility: "partial",
        address: { ...cityTier, city: null },
      }),
    ).toBeNull();
    expect(
      guestZone({
        address_visibility: "area",
        address: { ...areaTier, area: null },
      }),
    ).toBeNull();
  });

  it("is nothing when hidden, even if the payload carries an address", () => {
    expect(guestZone({ address_visibility: "hidden", address })).toBeNull();
    expect(guestZone({ address_visibility: "full", address: null })).toBeNull();
  });
});
