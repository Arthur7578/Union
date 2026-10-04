import { isPhoneCountry, type PhoneCountry } from "@union/shared";

/** Longer than this and the field would sit on "Choose a country" for no
 *  good reason; the browser language is a fine answer after it. */
const LOOKUP_TIMEOUT_MS = 3000;

let lookup: Promise<PhoneCountry | null> | null = null;

/**
 * The country the visitor's request comes from (see /api/geo), or null when
 * it can't be told. Asked once per page load and shared by every phone field
 * on it. Never rejects: not knowing is an answer.
 */
export function getRequestCountry(): Promise<PhoneCountry | null> {
  lookup ??= fetch("/api/geo", {
    cache: "no-store",
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: unknown) => {
      const country = (body as { country?: unknown } | null)?.country;
      return typeof country === "string" && isPhoneCountry(country)
        ? country
        : null;
    })
    .catch(() => null);
  return lookup;
}

/** Forget the answer so the next call asks again. For tests. */
export function forgetRequestCountry(): void {
  lookup = null;
}
