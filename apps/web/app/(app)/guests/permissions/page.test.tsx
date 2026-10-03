// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Wedding } from "@union/shared";

const harness = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateWedding: vi.fn(),
  wedding: null as Wedding | null,
}));

vi.mock("@/lib/wedding", () => ({
  useWedding: () => ({ wedding: harness.wedding, refresh: harness.refresh }),
}));

vi.mock("@/lib/data", () => ({
  updateWedding: harness.updateWedding,
}));

vi.mock("@/components/BackHeader", () => ({
  BackHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import GuestPermissionsPage from "./page";

const wedding = (patch: Partial<Wedding> = {}): Wedding => ({
  address_area: null,
  address_city: null,
  address_country: null,
  address_line: null,
  address_postal_code: null,
  address_visibility: "hidden",
  allow_guests_add_children: true,
  allow_guests_add_partner: false,
  allow_name_fallback: false,
  allow_rsvp_maybe: false,
  autonomy: "ask",
  ceremony_reserved_rows: 0,
  ceremony_rows: 10,
  created_at: "2026-08-20T00:00:00.000Z",
  default_locale: "en",
  event_date: null,
  guest_count_target: null,
  guest_join_auth_mode: "contact",
  guest_modules: {},
  id: "wedding-1",
  join_code: "TEST26",
  max_children_per_guest: 3,
  owner_id: "owner-1",
  partner_one: "Maya",
  partner_two: "Daniel",
  rsvp_form_questions: null,
  sms_brevo_api_key: null,
  sms_sender: null,
  sms_template: null,
  style_vibe: null,
  venue_address: null,
  venue_name: null,
  ...patch,
});

describe("/guests/permissions", () => {
  beforeEach(() => {
    harness.wedding = wedding();
    harness.refresh.mockReset().mockResolvedValue(undefined);
    harness.updateWedding.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders stored defaults and persists the edited controls", async () => {
    render(<GuestPermissionsPage />);

    const partner = screen.getByRole("checkbox", {
      name: /Allow guests to add a partner from their RSVP/i,
    });
    const children = screen.getByRole("checkbox", {
      name: /Allow guests to add children from their RSVP/i,
    });
    const cap = screen.getByPlaceholderText("e.g. 3");

    expect(partner).not.toBeChecked();
    expect(children).toBeChecked();
    expect(screen.getByRole("radio", { name: /Cap at/i })).toBeChecked();
    expect(cap).toHaveValue(3);

    fireEvent.click(partner);
    fireEvent.change(cap, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));

    await waitFor(() => {
      expect(harness.updateWedding).toHaveBeenCalledWith("wedding-1", {
        allow_guests_add_partner: true,
        allow_guests_add_children: true,
        max_children_per_guest: 2,
      });
    });
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Saved" })).toBeEnabled();
  });

  it("shows validation feedback without writing a partial update", async () => {
    harness.wedding = wedding({ max_children_per_guest: null });
    render(<GuestPermissionsPage />);

    fireEvent.click(screen.getByRole("radio", { name: /Cap at/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));

    expect(
      await screen.findByText(/Enter a whole number of children/i),
    ).toBeVisible();
    expect(harness.updateWedding).not.toHaveBeenCalled();
    expect(harness.refresh).not.toHaveBeenCalled();
  });

  it("clears a stored cap when children are disabled", async () => {
    render(<GuestPermissionsPage />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Allow guests to add children from their RSVP/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));

    await waitFor(() => {
      expect(harness.updateWedding).toHaveBeenCalledWith("wedding-1", {
        allow_guests_add_partner: false,
        allow_guests_add_children: false,
        max_children_per_guest: null,
      });
    });
    expect(harness.refresh).toHaveBeenCalledOnce();
  });
});
