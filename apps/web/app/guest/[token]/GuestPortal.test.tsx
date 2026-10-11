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

const invitation = (
  opts: {
    status?: "pending" | "attending";
    modules?: Record<string, boolean>;
    companions?: unknown[];
    customForms?: unknown[];
    rsvpForm?: unknown;
  } = {},
) =>
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
    companions: opts.companions ?? [],
    custom_forms: opts.customForms ?? [],
    rsvp_form: opts.rsvpForm ?? null,
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

describe("GuestPortal's forms checklist", () => {
  const guinevere = {
    id: "c-1",
    first_name: "Guinevere",
    last_name: null,
    age_years: null,
    relationship: "partner_of",
    rsvp_status: "attending",
    dietary_notes: null,
  };
  const dinner = (perPerson: boolean) => ({
    id: "form-1",
    title: "Dinner",
    guest_copy: null,
    questions: [],
    published: true,
    opens_at: null,
    closes_at: null,
    per_person: perPerson,
    answers: {},
    companion_answers: {},
  });

  it("shows how far a per-person form has got, and keeps it to do until everyone is answered for", async () => {
    hub(invitation({ status: "attending", companions: [guinevere], customForms: [dinner(true)] }));
    expect(await screen.findByText("Answered for 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("counts a form asked once per invitation as done once the guest has answered", async () => {
    hub(invitation({ status: "attending", companions: [guinevere], customForms: [dinner(false)] }));
    await screen.findByText("Dinner");
    expect(screen.queryByText(/Answered for/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });
});

describe("GuestPortal and the RSVP's opening window", () => {
  const rsvpForm = (window: { published?: boolean; opens_at?: string | null; closes_at?: string | null }) => ({
    id: "rsvp-1",
    title: null,
    subtitle: null,
    label_attending: null,
    label_declined: null,
    published: window.published ?? true,
    opens_at: window.opens_at ?? null,
    closes_at: window.closes_at ?? null,
    questions: [],
    answers: null,
    companion_answers: null,
  });

  it("offers no reply once the couple has closed the RSVP", async () => {
    markRsvpHandoff("tok");
    hub(invitation({ rsvpForm: rsvpForm({ closes_at: "2000-01-01T00:00:00Z" }) }));
    expect(await screen.findByText("Closed")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: "Respond to the invitation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: rsvpQuestion })).not.toBeInTheDocument();
  });

  it("keeps a guest's answer on show, without an edit link, after it closes", async () => {
    hub(invitation({ status: "attending", rsvpForm: rsvpForm({ closes_at: "2000-01-01T00:00:00Z" }) }));
    expect(await screen.findByText("You'll be with us")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change my reply" })).not.toBeInTheDocument();
  });

  it("says when the RSVP isn't open yet", async () => {
    hub(invitation({ rsvpForm: rsvpForm({ opens_at: "2999-01-01T00:00:00Z" }) }));
    expect(await screen.findByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respond to the invitation" })).not.toBeInTheDocument();
  });
});
