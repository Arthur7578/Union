import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  pickLocaleFromAcceptLanguage,
  type Locale,
} from "./index";

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
