// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

/**
 * The join form takes an email or a phone in one field and hands it to
 * find_guest_by_contact, which releases an invite token on a match. A number
 * only identifies someone with its country, so whatever reaches the database
 * has to state one: the form asks for the country while a number is typed
 * without "+", and sends E.164.
 */

const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

vi.mock("@/lib/auth", () => ({
  LAST_EMAIL_KEY: "union.lastEmail",
  sendEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

vi.mock("@/lib/guestIdentity", () => ({ writeActiveGuestIdentity: vi.fn() }));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    rpc: harness.rpc,
  }),
}));

import { JoinExperience } from "./JoinExperience";

const preview = {
  partner_one: "Maya",
  partner_two: "Daniel",
  event_date: null,
  venue_name: null,
  guest_join_auth_mode: "contact" as const,
  address_visibility: "hidden" as const,
  address: null,
};

beforeEach(() => {
  harness.rpc.mockReset();
  harness.rpc.mockResolvedValue({ data: { status: "not_found" }, error: null });
});

afterEach(cleanup);

async function openForm() {
  render(<JoinExperience code="abc123" preview={preview} />);
  return (await screen.findByPlaceholderText(
    en.guestJoin.contactPlaceholder,
  )) as HTMLInputElement;
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: en.guestJoin.continueButton }));

const lookupArgs = () => harness.rpc.mock.calls[0]?.[1];

describe("JoinExperience contact lookup", () => {
  it("sends a national number as E.164 in the country the guest picked", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(screen.getByLabelText(en.common.phoneCountry), {
      target: { value: "FR" },
    });
    submit();

    await waitFor(() => expect(harness.rpc).toHaveBeenCalled());
    expect(harness.rpc.mock.calls[0]?.[0]).toBe("find_guest_by_contact");
    expect(lookupArgs()).toMatchObject({
      p_join_code: "abc123",
      p_contact: "+33612345678",
    });
  });

  it("reads the same digits as another country's number when asked to", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "0612345678" } });
    fireEvent.change(screen.getByLabelText(en.common.phoneCountry), {
      target: { value: "NL" },
    });
    submit();

    await waitFor(() => expect(harness.rpc).toHaveBeenCalled());
    expect(lookupArgs()).toMatchObject({ p_contact: "+31612345678" });
  });

  it("does not ask for a country when the number states its own", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "+31 6 12345678" } });
    expect(screen.queryByLabelText(en.common.phoneCountry)).toBeNull();
    submit();

    await waitFor(() => expect(harness.rpc).toHaveBeenCalled());
    expect(lookupArgs()).toMatchObject({ p_contact: "+31612345678" });
  });

  it("never sends a national number with no country", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "06 12 34 56 78" } });
    fireEvent.change(screen.getByLabelText(en.common.phoneCountry), {
      target: { value: "" },
    });
    submit();

    expect(await screen.findByText(en.common.phoneCountryMissing)).toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("sends an email as typed and shows no country picker", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "jean2@example.test" } });
    expect(screen.queryByLabelText(en.common.phoneCountry)).toBeNull();
    submit();

    await waitFor(() => expect(harness.rpc).toHaveBeenCalled());
    expect(lookupArgs()).toMatchObject({ p_contact: "jean2@example.test" });
  });
});
