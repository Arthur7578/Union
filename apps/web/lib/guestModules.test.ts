import { describe, expect, it } from "vitest";
import {
  GUEST_MODULE_KEYS,
  enabledGuestModules,
  resolveGuestModules,
  toStoredGuestModules,
} from "@union/shared";

/** Every part on: what a couple gets by also turning carpooling on. */
const ALL_ON = {
  word: true,
  weekend: true,
  venue: true,
  travel: true,
  dress: true,
  faq: true,
};
/** What a couple who has chosen nothing gets: carpooling is off until they
 *  turn it on (its board still shows sample posts, issue #109). */
const DEFAULTS = { ...ALL_ON, travel: false };

describe("wedding page parts", () => {
  it("shows every part but carpooling when the couple has changed nothing", () => {
    expect(resolveGuestModules({})).toEqual(DEFAULTS);
  });

  it("turns carpooling on only when the couple asks for it", () => {
    expect(resolveGuestModules({ travel: true })).toEqual(ALL_ON);
    expect(enabledGuestModules({ travel: true })).toContain("travel");
    expect(enabledGuestModules({})).not.toContain("travel");
  });

  it("turns off the parts explicitly set to false", () => {
    expect(resolveGuestModules({ dress: false })).toEqual({ ...DEFAULTS, dress: false });
  });

  it("treats a stored true as on, same as an absent key, for the parts on by default", () => {
    expect(resolveGuestModules({ word: true, faq: false })).toEqual({ ...DEFAULTS, faq: false });
  });

  it("falls back to the defaults for a malformed value", () => {
    // A bad row must never blank out a guest's invitation.
    expect(resolveGuestModules(null)).toEqual(DEFAULTS);
    expect(resolveGuestModules(undefined)).toEqual(DEFAULTS);
    expect(resolveGuestModules("nope")).toEqual(DEFAULTS);
    expect(resolveGuestModules(["faq"])).toEqual(DEFAULTS);
    expect(resolveGuestModules({ faq: "no" })).toEqual(DEFAULTS);
    expect(resolveGuestModules({ faq: 0, travel: "yes" })).toEqual(DEFAULTS);
  });

  it("ignores keys that name no part, including the hub's old ones", () => {
    expect(resolveGuestModules({ gifts: false, logistics: false, forms: false, dress: false })).toEqual({
      ...DEFAULTS,
      dress: false,
    });
  });

  it("lists the parts that are on in the order guests see them", () => {
    expect(enabledGuestModules({ travel: true })).toEqual([...GUEST_MODULE_KEYS]);
    expect(enabledGuestModules({ word: false })).toEqual(["weekend", "venue", "dress", "faq"]);
  });

  it("allows every part off: the page is then the faire-part and the reply", () => {
    const off = Object.fromEntries(GUEST_MODULE_KEYS.map((k) => [k, false]));
    expect(enabledGuestModules(off)).toEqual([]);
  });

  it("stores only the choices that differ from the defaults", () => {
    expect(toStoredGuestModules(DEFAULTS)).toEqual({});
    expect(toStoredGuestModules({ ...DEFAULTS, faq: false })).toEqual({ faq: false });
    expect(toStoredGuestModules(ALL_ON)).toEqual({ travel: true });
  });

  it("round-trips a couple's choice through storage", () => {
    for (const chosen of [DEFAULTS, ALL_ON, { ...ALL_ON, weekend: false, dress: false }]) {
      expect(resolveGuestModules(toStoredGuestModules(chosen))).toEqual(chosen);
    }
  });
});
