// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { markRsvpHandoff } from "@/lib/rsvpHandoff";

/**
 * "Respond to the invitation" means answering it: a guest who has just chosen
 * it (on the faire-part, or through the group link) lands in the RSVP, not
 * on the hub with a second button. Everyone else lands on the hub.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}));

import { GuestPortal } from "./GuestPortal";
import type { DBInvitation } from "./page";

const invitation = (opts: { status?: "pending" | "attending"; modules?: Record<string, boolean> } = {}) =>
  ({
    wedding: {
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: null,
      venue_name: null,
      address_visibility: "hidden",
      address: null,
      guest_modules: opts.modules,
    },
    guest: {
      id: "g-1",
      first_name: "Arthur",
      last_name: "Pendragon",
      rsvp_status: opts.status ?? "pending",
      dietary_notes: "",
      message: "",
    },
    companions: [],
    permissions: { can_add_partner: false, can_add_kids: false, kids_remaining: 0 },
    self_merge_candidates: [],
  }) as unknown as DBInvitation;

const hub = (inv: DBInvitation) =>
  render(
    <LocaleProvider initialLocale="en">
      <GuestPortal token="tok" invitation={inv} isDemo />
    </LocaleProvider>,
  );

const rsvpQuestion = /Arthur, will you join us\?/;

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("GuestPortal and the RSVP handoff", () => {
  it("opens the RSVP at its first question for a guest who just chose to respond", async () => {
    markRsvpHandoff("tok");
    hub(invitation());
    expect(await screen.findByRole("heading", { name: rsvpQuestion })).toBeInTheDocument();
  });

  it("lands on the hub when nobody just chose to respond", async () => {
    hub(invitation());
    expect(await screen.findByRole("button", { name: "Respond to the invitation" })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("heading", { name: rsvpQuestion })).not.toBeInTheDocument();
  });

  it("lands on the hub for a guest who has already replied", async () => {
    markRsvpHandoff("tok");
    hub(invitation({ status: "attending" }));
    expect(await screen.findByText("You'll be with us")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("heading", { name: rsvpQuestion })).not.toBeInTheDocument();
  });

  it("lands on the hub when the couple turned the RSVP off", async () => {
    markRsvpHandoff("tok");
    hub(invitation({ modules: { forms: false } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("heading", { name: rsvpQuestion })).not.toBeInTheDocument();
  });
});
