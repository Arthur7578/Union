import { NextResponse } from "next/server";
import { isPhoneCountry } from "@union/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The country the caller's request comes from, so a phone field can start on
 * it instead of guessing from the browser's language (a French organiser on
 * an English browser would otherwise start on the United States).
 *
 * It is the host's own coarse reading of the request's IP address: Vercel sets
 * `x-vercel-ip-country` to a two-letter ISO 3166-1 code on every request. It is
 * a country and nothing finer, needs no permission from the visitor, and is
 * neither stored nor logged here. Anything that is not a country a phone
 * number can belong to (no header, a VPN or Tor placeholder, a typo) is null,
 * and the caller falls back to the browser language.
 *
 * No sign-in is needed: it only ever answers about the caller's own request,
 * and the join form for guests asks for it too. It must not be cached and
 * shared, since the answer is different for every visitor.
 */
export function GET(request: Request) {
  const header = (request.headers.get("x-vercel-ip-country") ?? "")
    .trim()
    .toUpperCase();
  const country = isPhoneCountry(header) ? header : null;
  return NextResponse.json(
    { country },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
