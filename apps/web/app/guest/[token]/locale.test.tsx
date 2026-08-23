import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invitation } from "@union/shared";
import { readInitialLocale } from "@/lib/testing/initialLocale";

/**
 * What language a guest's invitation opens in, decided by the page rather
 * than by the ranking function on its own.
 *
 * lib/i18n/guestLocale.test.ts already pins the ranking. These tests pin the
 * wiring around it: that this page still gathers all five signals and hands
 * each one to resolveGuestLocale under the right name. Dropping one — no
 * longer passing the wedding's default, reading `locale` where it meant
 * `chosen_locale` — leaves the ranking's own tests green while every guest
 * quietly reads the wrong language, so the assertions here are on the page's
 * output for a whole request, with only one signal moved at a time.
 */

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
  invitation: null as Invitation | null,
  rsvpFormsError: false,
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
      if (fn === "get_invitation") {
        return Promise.resolve({ data: request.invitation, error: null });
      }
      if (fn === "get_invitation_rsvp_forms") {
        if (request.rsvpFormsError) {
          return Promise.resolve({ data: null, error: new Error("RPC unavailable") });
        }
        return Promise.resolve({
          data: { primary: null, reconfirmation: null },
          error: null,
        });
      }
      if (fn === "get_guest_email_status") {
        return Promise.resolve({ data: { email_missing: false }, error: null });
      }
      return Promise.resolve({
        data: null,
        error: new Error(`unstubbed rpc: ${fn}`),
      });
    },
  }),
}));

// The guest UI itself is irrelevant here and drags in the browser: stub it.
vi.mock("./GuestPortal", () => ({ GuestPortal: () => null }));
vi.mock("./GuestEmailGate", () => ({ GuestEmailGate: () => null }));
vi.mock("./GuestIdentityGate", () => ({ GuestIdentityGate: () => null }));

function invitation(signals: {
  weddingDefault?: string | null;
  organiserOverride?: string | null;
  guestChoice?: string | null;
}): Invitation {
  return {
    wedding: {
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: "2026-09-20",
      venue_name: "Wildflower Barn",
      address_visibility: "hidden",
      address: null,
      default_locale: signals.weddingDefault ?? null,
    },
    guest: {
      id: "guest-1",
      first_name: "Amélie",
      last_name: "Rousseau",
      age_years: 34,
      rsvp_status: "pending",
      dietary_notes: null,
      message: null,
      locale: signals.organiserOverride ?? null,
      chosen_locale: signals.guestChoice ?? null,
    },
    companions: [],
    permissions: {
      can_add_partner: false,
      can_add_kids: false,
      kids_remaining: 0,
    },
    self_merge_candidates: [],
  };
}

/** Serve one request for /guest/<token> and report the language it opened in. */
async function openInvitation(): Promise<string> {
  const { default: GuestExperiencePage } = await import("./page");
  const tree = await GuestExperiencePage({
    params: Promise.resolve({ token: "invite-token" }),
  });
  return readInitialLocale(tree);
}

describe("the language a guest's invitation opens in", () => {
  beforeEach(() => {
    request.cookie = undefined;
    request.acceptLanguage = null;
    request.invitation = null;
    request.rsvpFormsError = false;
  });

  it("honours the switcher this browser used, over everything else", async () => {
    request.cookie = "en";
    request.acceptLanguage = "fr-FR,fr;q=0.9";
    request.invitation = invitation({
      guestChoice: "fr",
      organiserOverride: "fr",
      weddingDefault: "fr",
    });

    expect(await openInvitation()).toBe("en");
  });

  it("carries a pick the guest made on another device", async () => {
    // Opened on a phone, switched to French; now reading on a borrowed
    // laptop that has no cookie and asks for English.
    request.acceptLanguage = "en-GB,en;q=0.9";
    request.invitation = invitation({
      guestChoice: "fr",
      organiserOverride: "en",
      weddingDefault: "en",
    });

    expect(await openInvitation()).toBe("fr");
  });

  it("carries the couple's override for this guest, over their browser", async () => {
    // Read from guests.locale — the Language field on the guest's page —
    // and not from chosen_locale, which is the guest's own pick.
    request.acceptLanguage = "en-GB,en;q=0.9";
    request.invitation = invitation({
      organiserOverride: "fr",
      weddingDefault: "en",
    });

    expect(await openInvitation()).toBe("fr");
  });

  it("lets the guest's browser outrank the wedding's default", async () => {
    // The bug this ranking exists to prevent: a French couple's default
    // language must not serve a French invitation to a guest whose browser
    // asks for English.
    request.acceptLanguage = "en-GB,en;q=0.9";
    request.invitation = invitation({ weddingDefault: "fr" });

    expect(await openInvitation()).toBe("en");
  });

  it("falls back to the wedding's default when the browser asks for a language we don't ship", async () => {
    // The signal most easily dropped without anything failing: a page that
    // stops passing weddingDefault reads "en" here, and every guest of a
    // French wedding lands in English.
    request.acceptLanguage = "de-DE,de;q=0.9";
    request.invitation = invitation({ weddingDefault: "fr" });

    expect(await openInvitation()).toBe("fr");
  });

  it("lands on English when neither the browser nor the wedding says anything", async () => {
    request.acceptLanguage = "de-DE,de;q=0.9";
    request.invitation = invitation({});

    expect(await openInvitation()).toBe("en");
  });

  it("treats a stale value that isn't a language we ship as absent", async () => {
    // chosen_locale and locale are free-text columns; a leftover 'de' must
    // not win the ranking and leave a guest on a half-German page.
    request.cookie = "de";
    request.invitation = invitation({
      guestChoice: "de",
      organiserOverride: "de",
      weddingDefault: "fr",
    });

    expect(await openInvitation()).toBe("fr");
  });

  it("still opens a valid invitation when RSVP follow-up questions fail to load", async () => {
    request.invitation = invitation({ weddingDefault: "fr" });
    request.rsvpFormsError = true;

    expect(await openInvitation()).toBe("fr");
  });
});
