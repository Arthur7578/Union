// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invitation } from "@union/shared";
import { LocaleProvider } from "@/lib/i18n/client";

/**
 * The order a guest meets things on their personal link: the invitation
 * first, then the hub. The link itself identifies the guest, so there is no
 * identity step, and a missing email never blocks the way (it is asked for
 * when the guest replies).
 */

const harness = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    rpc: harness.rpc,
  }),
}));

// The hub is huge and has its own concerns; here it only has to be reached.
vi.mock("./GuestPortal", () => ({ GuestPortal: () => <p>the hub</p> }));

import { GuestEntry } from "./GuestEntry";
import type { DBInvitation } from "./page";

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = vi.fn(); // jsdom does not implement it
  harness.rpc.mockClear();
});
afterEach(cleanup);

const invitation = (seen: boolean): DBInvitation =>
  ({
    wedding: {
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: "2027-06-12",
      venue_name: null,
      address_visibility: "hidden",
      address: null,
    },
    guest: {
      id: "guest-1",
      first_name: "Claire",
      last_name: "Martin",
      welcome_seen_at: seen ? "2026-10-01T10:00:00Z" : null,
    },
  }) as unknown as Invitation as DBInvitation;

const entry = (opts: { seen: boolean; emailMissing?: boolean; isDemo?: boolean }) =>
  render(
    <LocaleProvider initialLocale="en">
      <GuestEntry
        token="tok"
        invitation={invitation(opts.seen)}
        isDemo={opts.isDemo ?? false}
        emailMissing={opts.emailMissing ?? false}
      />
    </LocaleProvider>,
  );

const respond = () => screen.getByRole("button", { name: "Respond to the invitation" });

describe("GuestEntry", () => {
  it("shows the invitation, then the hub, with no identity step", async () => {
    entry({ seen: false });

    expect(screen.getByText("Dear Claire,")).toBeInTheDocument();
    expect(screen.queryByText("the hub")).not.toBeInTheDocument();

    fireEvent.click(respond());
    expect(await screen.findByText("the hub")).toBeInTheDocument();
    expect(screen.queryByText(/Continue as/)).not.toBeInTheDocument();
  });

  it("never stops a guest without an email on the way to the hub", async () => {
    entry({ seen: false, emailMissing: true });

    fireEvent.click(respond());
    expect(await screen.findByText("the hub")).toBeInTheDocument();
  });

  it("goes straight to the hub when there is nothing to check", async () => {
    entry({ seen: false });
    fireEvent.click(respond());
    expect(await screen.findByText("the hub")).toBeInTheDocument();
  });

  it("skips the welcome for a guest whose invitation says they have seen it", async () => {
    entry({ seen: true });

    expect(screen.queryByRole("button", { name: "Respond to the invitation" })).not.toBeInTheDocument();
    expect(await screen.findByText("the hub")).toBeInTheDocument();
  });

  it("records the welcome as seen on the guest's invitation", async () => {
    entry({ seen: false });
    fireEvent.click(respond());
    await waitFor(() =>
      expect(harness.rpc).toHaveBeenCalledWith("mark_welcome_seen", { p_token: "tok" }),
    );
  });

  it("records nothing for the demo guest", () => {
    entry({ seen: false, isDemo: true });
    fireEvent.click(respond());
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
