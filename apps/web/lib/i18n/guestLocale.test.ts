import { describe, expect, it } from "vitest";
import { detectLocaleFromAcceptLanguage, pickLocaleFromAcceptLanguage } from "./index";
import { guestLocale, resolveGuestLocale } from "./guestLocale";

describe("detectLocaleFromAcceptLanguage", () => {
  it("reads the primary subtag of the best-quality match", () => {
    expect(detectLocaleFromAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.5")).toBe("fr");
    expect(detectLocaleFromAcceptLanguage("en-GB")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("de;q=0.8,fr;q=0.9")).toBe("fr");
  });

  it("answers null when the browser asks for nothing we ship", () => {
    // The whole point of the null: "asked for German" must not be
    // indistinguishable from "asked for English", or a wedding's own default
    // language would lose to a header that never mentioned it.
    expect(detectLocaleFromAcceptLanguage("de-DE,de;q=0.9")).toBeNull();
    expect(detectLocaleFromAcceptLanguage("")).toBeNull();
    expect(detectLocaleFromAcceptLanguage(null)).toBeNull();
  });

  it("still defaults for screens with no wedding behind them", () => {
    expect(pickLocaleFromAcceptLanguage("de-DE")).toBe("en");
    expect(pickLocaleFromAcceptLanguage("fr")).toBe("fr");
  });
});

describe("resolveGuestLocale", () => {
  it("puts the guest's own pick on this device above everything", () => {
    expect(
      resolveGuestLocale({
        deviceChoice: "en",
        guestChoice: "fr",
        organiserOverride: "fr",
        detected: "fr",
        weddingDefault: "fr",
      }),
    ).toEqual({ locale: "en", source: "deviceChoice" });
  });

  it("honours a pick made on another device", () => {
    // Opened on a phone, switched to French, now reading on a fresh laptop.
    expect(
      resolveGuestLocale({
        guestChoice: "fr",
        organiserOverride: "en",
        detected: "en",
        weddingDefault: "en",
      }),
    ).toEqual({ locale: "fr", source: "guestChoice" });
  });

  it("lets the couple's override beat browser detection", () => {
    // The couple knows this guest reads French even on a borrowed laptop.
    expect(
      resolveGuestLocale({
        organiserOverride: "fr",
        detected: "en",
        weddingDefault: "en",
      }),
    ).toEqual({ locale: "fr", source: "organiserOverride" });
  });

  it("lets browser detection beat the wedding default", () => {
    // The heart of it: a French couple's default must not put an
    // English-speaking guest's invitation into French.
    expect(
      resolveGuestLocale({ detected: "en", weddingDefault: "fr" }),
    ).toEqual({ locale: "en", source: "detected" });
  });

  it("falls back to the wedding default when nothing is known", () => {
    // No cookie, no pick, no override, and a browser asking for German.
    expect(resolveGuestLocale({ detected: null, weddingDefault: "fr" })).toEqual({
      locale: "fr",
      source: "weddingDefault",
    });
  });

  it("lands on the app default when even the wedding has none", () => {
    expect(resolveGuestLocale({})).toEqual({ locale: "en", source: "fallback" });
  });

  it("treats anything that isn't a shipped locale as absent", () => {
    // jsonb columns and cookies can hold anything; a stale 'de' row must not
    // win the ranking and leave a guest with a half-German page.
    expect(
      resolveGuestLocale({
        deviceChoice: "de",
        guestChoice: "",
        organiserOverride: null,
        weddingDefault: "fr",
      }),
    ).toEqual({ locale: "fr", source: "weddingDefault" });
  });

  it("exposes the locale on its own for callers that don't care why", () => {
    expect(guestLocale({ organiserOverride: "fr" })).toBe("fr");
  });
});
