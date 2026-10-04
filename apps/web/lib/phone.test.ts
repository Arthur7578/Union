import { describe, expect, it } from "vitest";
import {
  dialCode,
  guessPhoneCountry,
  isValidPhone,
  parseStoredPhone,
  toStoredPhone,
} from "@union/shared";

/**
 * A guest's phone number is stored in E.164, built from the country the
 * person picked and what they typed. These pin the part the database can't
 * do for us: the same digits mean different numbers in different countries,
 * and the trunk "0" is dropped in some countries and kept in others.
 */

describe("toStoredPhone", () => {
  it("reads identical digits as the picked country's number", () => {
    expect(toStoredPhone("FR", "06 12 34 56 78")).toBe("+33612345678");
    expect(toStoredPhone("NL", "06 12345678")).toBe("+31612345678");
    expect(toStoredPhone("NL", "0612345678")).toBe("+31612345678");
  });

  it("handles numbers the old France-only reading could not", () => {
    expect(toStoredPhone("US", "415-555-2671")).toBe("+14155552671");
    expect(toStoredPhone("GB", "07911 123456")).toBe("+447911123456");
  });

  it("drops the trunk 0 where the country does, and keeps it where it does not", () => {
    expect(toStoredPhone("FR", "0612345678")).toBe("+33612345678");
    // Italian numbers keep their leading 0: Rome is +39 06...
    expect(toStoredPhone("IT", "06 1234 5678")).toBe("+390612345678");
  });

  it("lets a number that states its country override the picker", () => {
    expect(toStoredPhone("FR", "+31 6 12345678")).toBe("+31612345678");
    expect(toStoredPhone("FR", "0031 6 12345678")).toBe("+31612345678");
    expect(toStoredPhone(null, "+31 6 12345678")).toBe("+31612345678");
  });

  it("drops the bracketed trunk digit", () => {
    expect(toStoredPhone(null, "+33 (0)6 12 34 56 78")).toBe("+33612345678");
    expect(toStoredPhone("FR", "+44 (0)7911 123456")).toBe("+447911123456");
  });

  it("keeps the chosen country on a number that is still being typed", () => {
    // Never read as another country's number: it carries its own dial code.
    expect(toStoredPhone("NL", "06 123")).toBe("+31" + "06123");
    expect(toStoredPhone("FR", "06 12")).toBe("+33" + "0612");
  });

  it("returns nothing for nothing", () => {
    expect(toStoredPhone("FR", "")).toBe("");
    expect(toStoredPhone("FR", "   ")).toBe("");
    expect(toStoredPhone("FR", "abc")).toBe("");
  });

  it("never invents a country: no pick and no + stays as typed", () => {
    expect(toStoredPhone(null, "06 12 34 56 78")).toBe("06 12 34 56 78");
  });
});

describe("parseStoredPhone", () => {
  it("shows a stored E.164 number in its own country", () => {
    const parsed = parseStoredPhone("+31612345678");
    expect(parsed.country).toBe("NL");
    expect(parsed.national).toBe("06 12345678");
    expect(parsed.e164).toBe("+31612345678");
  });

  it("leaves a number saved before countries were captured exactly as it was", () => {
    expect(parseStoredPhone("06 12 34 56 78")).toEqual({
      country: null,
      national: "06 12 34 56 78",
      e164: null,
    });
  });

  it("shows only the digits of a wrong number under a calling code several countries share", () => {
    // toStoredPhone keeps the picked country's dial code on a number that
    // isn't valid there, so a French number typed under the United States
    // is saved as +10612345678. +1 is the picker's, not the person's, and
    // the digits don't say which of the +1 countries it was: show the
    // digits with no country, so a country can be picked for them.
    expect(parseStoredPhone("+10612345678")).toEqual({
      country: null,
      national: "0612345678",
      e164: null,
    });
    expect(parseStoredPhone("+44123")).toEqual({
      country: null,
      national: "123",
      e164: null,
    });
  });

  it("keeps a valid number that belongs to no country whole", () => {
    // +800 is real and valid, but not tied to a country: nothing to strip.
    expect(parseStoredPhone("+80012345678")).toEqual({
      country: null,
      national: "+80012345678",
      e164: null,
    });
  });

  it("reads a 00 prefix as international", () => {
    expect(parseStoredPhone("0033612345678").country).toBe("FR");
  });

  it("handles empty values", () => {
    expect(parseStoredPhone(null)).toEqual({ country: null, national: "", e164: null });
    expect(parseStoredPhone("  ")).toEqual({ country: null, national: "", e164: null });
  });
});

describe("isValidPhone", () => {
  it("accepts real numbers and rejects unfinished or country-less ones", () => {
    expect(isValidPhone("FR", "06 12 34 56 78")).toBe(true);
    expect(isValidPhone("FR", "06 12")).toBe(false);
    expect(isValidPhone(null, "06 12 34 56 78")).toBe(false);
    expect(isValidPhone(null, "+33 6 12 34 56 78")).toBe(true);
    expect(isValidPhone("FR", "")).toBe(false);
  });
});

describe("guessPhoneCountry", () => {
  it("takes the region from a language tag and nothing else", () => {
    expect(guessPhoneCountry("fr-FR")).toBe("FR");
    expect(guessPhoneCountry("en_GB")).toBe("GB");
    expect(guessPhoneCountry("fr")).toBeNull();
    expect(guessPhoneCountry("en-ZZ")).toBeNull();
    expect(guessPhoneCountry(null)).toBeNull();
  });
});

describe("dialCode", () => {
  it("prefixes the calling code", () => {
    expect(dialCode("FR")).toBe("+33");
    expect(dialCode("US")).toBe("+1");
  });
});
