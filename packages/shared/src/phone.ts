import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * A guest's phone number is only useful if it says which country it is
 * from: the same digits (06 12 34 56 78) belong to different people in
 * different countries, and nothing downstream can tell them apart. So a
 * number is captured as a country plus a national number, and stored as
 * E.164 (+33612345678). These helpers are the one place that turns one
 * into the other.
 */

export type PhoneCountry = CountryCode;

export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries();

export function isPhoneCountry(value: string): value is PhoneCountry {
  return (PHONE_COUNTRIES as readonly string[]).includes(value);
}

/** "+33" for "FR". */
export function dialCode(country: PhoneCountry): string {
  return `+${getCountryCallingCode(country)}`;
}

export type ParsedPhone = {
  /** The country the number belongs to, when it states one. */
  country: PhoneCountry | null;
  /** The number as a person writes it in that country (0 6 12 34 56 78). */
  national: string;
  /** Canonical +CCNNNN, only for a number that is valid in its country. */
  e164: string | null;
};

/**
 * Read a stored phone. A stored value that starts with "+" (or "00")
 * states its own country. Anything else is a number saved before
 * countries were captured: its country is unknown, and it is returned as
 * typed so nothing is silently rewritten.
 *
 * One more case: a number that isn't valid, under a calling code several
 * countries share (+1, +44, +7...). toStoredPhone keeps the picked
 * country's dial code on an unfinished or wrong number, so it comes back
 * as "+10612345678" and the digits don't say which country it was. Its
 * country is unknown, like a legacy number's, and the "+1" is the picker's
 * dial code, not something the person typed, so only the digits are
 * returned. Left as "+10612345678" the text would state its own country
 * and the picker could no longer correct it.
 */
export function parseStoredPhone(stored: string | null | undefined): ParsedPhone {
  const raw = (stored ?? "").trim();
  if (!raw) return { country: null, national: "", e164: null };
  const parsed = parsePhoneNumberFromString(raw.replace(/^00/, "+"));
  if (parsed && parsed.country) {
    return {
      country: parsed.country,
      national: parsed.formatNational(),
      e164: parsed.isValid() ? parsed.number : null,
    };
  }
  // A valid number with no country is a real one that isn't tied to a
  // country (+800...): it stays whole.
  if (parsed && !parsed.isValid()) {
    return { country: null, national: parsed.nationalNumber, e164: null };
  }
  return { country: null, national: raw, e164: null };
}

/**
 * Combine a picked country and what was typed into the value to store.
 *
 * - Nothing typed: "".
 * - Typed with a "+" or "00": the number states its own country, so the
 *   picker is ignored.
 * - A valid number in the picked country: its E.164 form, with the
 *   national trunk prefix handled per country (0 is dropped in France and
 *   the Netherlands, kept in Italy).
 * - Anything else (still being typed, or not a real number): "+" and the
 *   dial code and the digits, so the chosen country is not lost. It is
 *   not valid, and the form says so, but it is never read as another
 *   country's number.
 */
export function toStoredPhone(
  country: PhoneCountry | null,
  typed: string,
): string {
  const text = typed.trim();
  if (!text) return "";
  if (/^\s*(\+|00)/.test(text)) {
    const own = parsePhoneNumberFromString(text.replace(/^\s*00/, "+"));
    if (own?.isValid()) return own.number;
    const digits = text.replace(/\D/g, "").replace(/^00/, "");
    return digits ? `+${digits}` : "";
  }
  if (!country) return text;
  const parsed = parsePhoneNumberFromString(text, country);
  if (parsed?.isValid()) return parsed.number;
  const digits = text.replace(/\D/g, "");
  return digits ? `${dialCode(country)}${digits}` : "";
}

/** Whether what was typed, with the picked country, is a real number. */
export function isValidPhone(
  country: PhoneCountry | null,
  typed: string,
): boolean {
  const text = typed.trim();
  if (!text) return false;
  const own = /^\s*(\+|00)/.test(text);
  if (!own && !country) return false;
  const parsed = own
    ? parsePhoneNumberFromString(text.replace(/^\s*00/, "+"))
    : parsePhoneNumberFromString(text, country as PhoneCountry);
  return Boolean(parsed?.isValid());
}

/**
 * A starting point for the picker, from a browser or app language tag
 * such as "fr-FR". It only pre-selects a value the person can see and
 * change; it is never applied to a number silently. Null when the tag
 * carries no region.
 */
export function guessPhoneCountry(
  languageTag: string | null | undefined,
): PhoneCountry | null {
  const region = (languageTag ?? "").split(/[-_]/)[1]?.toUpperCase() ?? "";
  return isPhoneCountry(region) ? region : null;
}
