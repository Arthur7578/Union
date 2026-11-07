import { describe, expect, it } from "vitest";
import {
  GUEST_MODULE_KEYS,
  enabledGuestModules,
  resolveGuestModules,
  toStoredGuestModules,
} from "@union/shared";

const ALL_ON = {
  word: true,
  weekend: true,
  venue: true,
  travel: true,
  dress: true,
  faq: true,
};

describe("wedding page parts", () => {
  it("shows every part when the couple has changed nothing", () => {
    expect(resolveGuestModules({})).toEqual(ALL_ON);
  });

  it("turns off only the parts explicitly set to false", () => {
    expect(resolveGuestModules({ travel: false, dress: false })).toEqual({
      ...ALL_ON,
      travel: false,
      dress: false,
    });
  });

  it("treats a stored true as on, same as an absent key", () => {
    expect(resolveGuestModules({ word: true, faq: false })).toEqual({ ...ALL_ON, faq: false });
  });

  it("falls back to every part on for a malformed value", () => {
    // A bad row must never blank out a guest's invitation.
    expect(resolveGuestModules(null)).toEqual(ALL_ON);
    expect(resolveGuestModules(undefined)).toEqual(ALL_ON);
    expect(resolveGuestModules("nope")).toEqual(ALL_ON);
    expect(resolveGuestModules(["faq"])).toEqual(ALL_ON);
    expect(resolveGuestModules({ faq: "no" })).toEqual(ALL_ON);
    expect(resolveGuestModules({ faq: 0 })).toEqual(ALL_ON);
  });

  it("ignores keys that name no part, including the hub's old ones", () => {
    expect(resolveGuestModules({ gifts: false, logistics: false, forms: false, travel: false })).toEqual({
      ...ALL_ON,
      travel: false,
    });
  });

  it("lists the parts that are on in the order guests see them", () => {
    expect(enabledGuestModules({})).toEqual([...GUEST_MODULE_KEYS]);
    expect(enabledGuestModules({ travel: false, word: false })).toEqual(["weekend", "venue", "dress", "faq"]);
  });

  it("allows every part off: the page is then the faire-part and the reply", () => {
    const off = Object.fromEntries(GUEST_MODULE_KEYS.map((k) => [k, false]));
    expect(enabledGuestModules(off)).toEqual([]);
  });

  it("stores only the off decisions, so a later part defaults to on", () => {
    expect(toStoredGuestModules({ ...ALL_ON, travel: false, faq: false })).toEqual({ travel: false, faq: false });
    expect(toStoredGuestModules(ALL_ON)).toEqual({});
  });

  it("round-trips a couple's choice through storage", () => {
    const chosen = { ...ALL_ON, weekend: false, dress: false };
    expect(resolveGuestModules(toStoredGuestModules(chosen))).toEqual(chosen);
  });
});
