import { beforeEach, describe, expect, it, vi } from "vitest";
import { readInitialLocale } from "@/lib/testing/initialLocale";
import type { JoinWeddingPreview } from "./page";

/**
 * What language a generic join link opens in.
 *
 * No guest record exists yet at this point, so only three of the five signals
 * can have an opinion: what this browser picked, what it asks for, and the
 * language the couple writes their content in. These tests pin that the page
 * hands all three to resolveGuestLocale, and in particular that the couple's
 * default stays the floor rather than becoming the starting point — the join
 * page reaches it through a different RPC than the invitation portal does, so
 * it can lose that wiring on its own.
 */

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
  preview: null as unknown,
}));

vi.mock("next/headers", async () => {
  const { LOCALE_COOKIE } = await import("@/lib/i18n");
  return {
    cookies: () =>
      Promise.resolve({
        get: (name: string) =>
          name === LOCALE_COOKIE && request.cookie !== undefined
            ? { value: request.cookie }
            : undefined,
      }),
    headers: () =>
      Promise.resolve({
        get: (name: string) =>
          name.toLowerCase() === "accept-language"
            ? request.acceptLanguage
            : null,
      }),
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    rpc: (fn: string) => {
      if (fn === "get_wedding_by_join_code") {
        return Promise.resolve({ data: request.preview, error: null });
      }
      return Promise.resolve({
        data: null,
        error: new Error(`unstubbed rpc: ${fn}`),
      });
    },
  }),
}));

vi.mock("./JoinExperience", () => ({ JoinExperience: () => null }));

function preview(defaultLocale: string | null): JoinWeddingPreview {
  return {
    partner_one: "Maya",
    partner_two: "Daniel",
    event_date: "2026-09-20",
    venue_name: "Wildflower Barn",
    guest_join_auth_mode: "contact",
    default_locale: defaultLocale,
  };
}

/** Serve one request for /join/<code> and report the language it opened in. */
async function openJoinPage(): Promise<string> {
  const { default: JoinPage } = await import("./page");
  const tree = await JoinPage({ params: Promise.resolve({ code: "MAYA26" }) });
  return readInitialLocale(tree);
}

describe("the language a join link opens in", () => {
  beforeEach(() => {
    request.cookie = undefined;
    request.acceptLanguage = null;
    request.preview = null;
  });

  it("honours the switcher this browser used", async () => {
    request.cookie = "en";
    request.acceptLanguage = "fr-FR,fr;q=0.9";
    request.preview = preview("fr");

    expect(await openJoinPage()).toBe("en");
  });

  it("lets the visitor's browser outrank the wedding's default", async () => {
    request.acceptLanguage = "en-GB,en;q=0.9";
    request.preview = preview("fr");

    expect(await openJoinPage()).toBe("en");
  });

  it("falls back to the wedding's default when the browser asks for a language we don't ship", async () => {
    // Pins that get_wedding_by_join_code's default_locale actually reaches
    // the ranking: without it this page reads "en" for a French wedding.
    request.acceptLanguage = "de-DE,de;q=0.9";
    request.preview = preview("fr");

    expect(await openJoinPage()).toBe("fr");
  });

  it("lands on English when the wedding has no default", async () => {
    request.acceptLanguage = "de-DE,de;q=0.9";
    request.preview = preview(null);

    expect(await openJoinPage()).toBe("en");
  });
});
