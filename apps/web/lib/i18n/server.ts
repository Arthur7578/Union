import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  detectLocaleFromAcceptLanguage,
  isLocale,
  pickLocaleFromAcceptLanguage,
  type Locale,
} from "./index";

/** The language this browser has explicitly asked for, or null if it never
 * has. Distinguishing "chose English" from "never chose" is what lets the
 * guest portal honour a language the couple recorded for a guest without
 * overriding that guest's own pick. */
export async function readLocaleCookie(): Promise<Locale | null> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** What this browser asks for in `Accept-Language`, or null when it asks for
 * nothing this app ships. Kept separate from `resolveLocale` because guest
 * screens rank this against a wedding's default language rather than falling
 * straight through to English — see lib/i18n/guestLocale.ts. */
export async function detectLocale(): Promise<Locale | null> {
  try {
    const headerList = await headers();
    return detectLocaleFromAcceptLanguage(headerList.get("accept-language"));
  } catch {
    return null;
  }
}

/** Server-side locale resolution: cookie beats Accept-Language, both beat the
 * default. Used by the root layout so `<html lang>` matches the first paint. */
export async function resolveLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieValue)) return cookieValue;
  } catch {
    // Called from a place without a cookie store — fall through.
  }
  try {
    const headerList = await headers();
    return pickLocaleFromAcceptLanguage(headerList.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}
