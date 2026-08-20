import { describe, expect, it } from "vitest";
import {
  GUEST_MODULE_KEYS,
  enabledGuestModules,
  resolveGuestModules,
  toStoredGuestModules,
} from "@union/shared";

describe("guest invitation modules", () => {
  it("shows every module when the couple has changed nothing", () => {
    // '{}' is what every wedding written before the column existed holds,
    // so this is the "nothing changed, nothing lost" case.
    expect(resolveGuestModules({})).toEqual({
      forms: true,
      travel: true,
      logistics: true,
      faq: true,
    });
  });

  it("turns off only the modules explicitly set to false", () => {
    expect(resolveGuestModules({ travel: false, logistics: false })).toEqual({
      forms: true,
      travel: false,
      logistics: false,
      faq: true,
    });
  });

  it("treats a stored true as on, same as an absent key", () => {
    expect(resolveGuestModules({ forms: true, faq: false })).toEqual({
      forms: true,
      travel: true,
      logistics: true,
      faq: false,
    });
  });

  it("falls back to the full experience on a malformed value", () => {
    // A bad row must never blank out a guest's invitation, so anything that
    // isn't an explicit false for a known key leaves that module on.
    const everything = {
      forms: true,
      travel: true,
      logistics: true,
      faq: true,
    };
    expect(resolveGuestModules(null)).toEqual(everything);
    expect(resolveGuestModules(undefined)).toEqual(everything);
    expect(resolveGuestModules("nope")).toEqual(everything);
    expect(resolveGuestModules(["faq"])).toEqual(everything);
    expect(resolveGuestModules({ faq: "no" })).toEqual(everything);
    expect(resolveGuestModules({ faq: 0 })).toEqual(everything);
  });

  it("ignores keys that name no module", () => {
    expect(resolveGuestModules({ gifts: false, travel: false })).toEqual({
      forms: true,
      travel: false,
      logistics: true,
      faq: true,
    });
  });

  it("lists enabled modules in the order guests see them", () => {
    expect(enabledGuestModules({})).toEqual([...GUEST_MODULE_KEYS]);
    expect(enabledGuestModules({ travel: false, forms: false })).toEqual([
      "logistics",
      "faq",
    ]);
  });

  it("stores only the off decisions, so a later module defaults to on", () => {
    expect(
      toStoredGuestModules({
        forms: true,
        travel: false,
        logistics: false,
        faq: false,
      }),
    ).toEqual({ travel: false, logistics: false, faq: false });
    expect(
      toStoredGuestModules({
        forms: true,
        travel: true,
        logistics: true,
        faq: true,
      }),
    ).toEqual({});
  });

  it("round-trips a couple's choice through storage", () => {
    const chosen = {
      forms: true,
      travel: false,
      logistics: false,
      faq: false,
    };
    expect(resolveGuestModules(toStoredGuestModules(chosen))).toEqual(chosen);
  });
});
