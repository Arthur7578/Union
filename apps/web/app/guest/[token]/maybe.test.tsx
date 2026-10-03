// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import type { DBInvitation } from "./page";

/**
 * The "maybe" reply, from the guest's side.
 *
 * The opt-in only means anything if the third button is genuinely absent when
 * the couple hasn't asked for it, and genuinely wired to 'maybe' when they
 * have. Both halves are asserted here on the rendered portal rather than on
 * the helper underneath, because the helper being right is no help if the
 * button reads the wrong flag or carries the wrong label.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
}));

import { GuestPortal } from "./GuestPortal";

function invitation(patch: {
  allowMaybe?: boolean;
  guestStatus?: DBInvitation["guest"]["rsvp_status"];
  labelMaybe?: string;
}): DBInvitation {
  return {
    wedding: {
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: "2026-09-20",
      venue_name: "Wildflower Barn",
      address_visibility: "full",
      address: {
        line: "123 Orchard Rd",
        postal_code: "97031",
        city: "Hood River",
        area: null,
        country: "United States",
      },
      default_locale: "en",
      guest_modules: {},
      allow_rsvp_maybe: patch.allowMaybe ?? false,
    },
    guest: {
      id: "guest-1",
      first_name: "Arthur",
      last_name: "Pendragon",
      age_years: 30,
      rsvp_status: patch.guestStatus ?? "pending",
      dietary_notes: null,
      message: null,
      locale: null,
      chosen_locale: null,
    },
    companions: [
      {
        id: "companion-1",
        first_name: "Guinevere",
        last_name: "Pendragon",
        age_years: 28,
        relationship: "partner_of",
        rsvp_status: "pending",
        dietary_notes: null,
      },
    ],
    permissions: {
      can_add_partner: false,
      can_add_kids: false,
      kids_remaining: 0,
    },
    self_merge_candidates: [],
    rsvp_form: {
      title: null,
      subtitle: null,
      label_attending: null,
      label_maybe: patch.labelMaybe ? { en: patch.labelMaybe } : null,
      label_declined: null,
    },
    custom_forms: [],
  };
}

/** Render the portal and open the RSVP drawer, which is where the reply
 *  buttons live. `isDemo` keeps every write local to the component. */
function openRsvp(inv: DBInvitation) {
  render(
    <LocaleProvider initialLocale="en">
      <GuestPortal token="demo" invitation={inv} isDemo />
    </LocaleProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: inv.guest.rsvp_status === "pending" ? "Start" : "Update",
    }),
  );
}

afterEach(() => cleanup());

describe("the guest's reply buttons", () => {
  it("offers only yes and no while the couple hasn't turned maybe on", () => {
    openRsvp(invitation({ allowMaybe: false }));

    expect(screen.getByRole("button", { name: /Attending/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Declined/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Not sure yet/ }),
    ).not.toBeInTheDocument();
  });

  it("offers a third reply once the couple turns it on", () => {
    openRsvp(invitation({ allowMaybe: true }));

    expect(screen.getByRole("button", { name: /Not sure yet/ })).toBeVisible();
  });

  it("uses the couple's own wording for it, not the system default", () => {
    openRsvp(invitation({ allowMaybe: true, labelMaybe: "Hoping to!" }));

    expect(screen.getByRole("button", { name: /Hoping to!/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Not sure yet/ }),
    ).not.toBeInTheDocument();
  });

  it("still asks a maybe about dietary notes and their companions", () => {
    // The follow-up questions are worth asking now: a second round once the
    // guest firms up is the thing that makes people stop replying.
    openRsvp(invitation({ allowMaybe: true }));

    expect(
      screen.queryByPlaceholderText(/vegetarian, nut allergies/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Not sure yet/ }));

    expect(
      screen.getByPlaceholderText(/vegetarian, nut allergies/i),
    ).toBeVisible();
    expect(screen.getByText(/Guinevere Pendragon/)).toBeVisible();
  });

  it("blocks the save while a stored maybe is no longer an accepted answer", () => {
    // The couple turned the option off after this guest replied. Their status
    // is left alone — converting it would invent a commitment — so the portal
    // asks them to pick a firm answer instead of submitting a reply the
    // server would refuse.
    openRsvp(invitation({ allowMaybe: false, guestStatus: "maybe" }));

    expect(screen.getByRole("button", { name: "Submit RSVP" })).toBeDisabled();
    expect(screen.getByText(/needs a firm answer now/i)).toBeVisible();

    // Their own row comes first; the companion below has the same buttons.
    fireEvent.click(screen.getAllByRole("button", { name: /Attending/ })[0]);

    expect(screen.getByRole("button", { name: "Submit RSVP" })).toBeEnabled();
    expect(screen.queryByText(/needs a firm answer now/i)).not.toBeInTheDocument();
  });

  it("leaves the save blocked until an untouched RSVP is answered", () => {
    openRsvp(invitation({ allowMaybe: true }));

    expect(screen.getByRole("button", { name: "Submit RSVP" })).toBeDisabled();
    // Nothing is picked, so there's no stale answer to warn about either.
    expect(screen.queryByText(/needs a firm answer now/i)).not.toBeInTheDocument();
  });
});
