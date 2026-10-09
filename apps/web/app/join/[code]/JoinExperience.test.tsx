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
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, replace: vi.fn() }),
}));

vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

const auth = vi.hoisted(() => ({ sendEmailOtp: vi.fn(), verifyEmailOtp: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  LAST_EMAIL_KEY: "union.lastEmail",
  sendEmailOtp: auth.sendEmailOtp,
  verifyEmailOtp: auth.verifyEmailOtp,
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
  harness.push.mockReset();
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

describe("JoinExperience hand-over to the guest's own link", () => {
  it("marks the welcome seen on the guest's link, then goes there", async () => {
    harness.rpc.mockImplementation((name: string) =>
      Promise.resolve({
        data: name === "find_guest_by_contact" ? { status: "match", token: "guest-token" } : null,
        error: null,
      }),
    );
    const input = await openForm();
    fireEvent.change(input, { target: { value: "jean2@example.test" } });
    submit();

    await waitFor(() => expect(harness.push).toHaveBeenCalled());
    expect(harness.rpc).toHaveBeenCalledWith("mark_welcome_seen", { p_token: "guest-token" });
    expect(harness.push.mock.calls[0]?.[0]).toContain("guest-token");
  });

  it("still goes there when recording that fails", async () => {
    harness.rpc.mockImplementation((name: string) =>
      name === "mark_welcome_seen"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({ data: { status: "match", token: "guest-token" }, error: null }),
    );
    const input = await openForm();
    fireEvent.change(input, { target: { value: "jean2@example.test" } });
    submit();

    await waitFor(() => expect(harness.push).toHaveBeenCalled());
  });
});

describe("JoinExperience, one question at a time", () => {
  it("asks for the first name when the contact matches several guests", async () => {
    harness.rpc.mockImplementation((name: string, args: { p_first_name: string | null }) =>
      Promise.resolve({
        data:
          name === "find_guest_by_contact"
            ? args.p_first_name
              ? { status: "match", token: "guest-token" }
              : { status: "ambiguous" }
            : null,
        error: null,
      }),
    );
    const input = await openForm();
    fireEvent.change(input, { target: { value: "family@example.test" } });
    submit();

    await screen.findByRole("heading", { name: en.guestJoin.firstNameTitle });
    fireEvent.change(screen.getByRole("textbox", { name: en.guestJoin.firstNameLabel }), {
      target: { value: "Jean" },
    });
    submit();

    await waitFor(() => expect(harness.push).toHaveBeenCalled());
    expect(harness.rpc).toHaveBeenCalledWith("find_guest_by_contact", {
      p_join_code: "abc123",
      p_contact: "family@example.test",
      p_first_name: "Jean",
    });
  });

  it("sends a code when the wedding needs one, then opens the guest's invitation", async () => {
    harness.rpc.mockImplementation((name: string) =>
      Promise.resolve({
        data:
          name === "find_guest_by_contact"
            ? { status: "otp_required" }
            : name === "get_guest_access_options"
              ? { status: "ok", matches: [{ guest_id: "g-1", first_name: "Jean", last_name: null }] }
              : name === "claim_guest_access"
                ? { status: "verified", token: "guest-token" }
                : null,
        error: null,
      }),
    );
    const input = await openForm();
    fireEvent.change(input, { target: { value: "jean@example.test" } });
    submit();

    await screen.findByRole("heading", { name: en.guestJoin.codeTitle });
    expect(auth.sendEmailOtp).toHaveBeenCalledWith("jean@example.test", undefined);
    fireEvent.change(screen.getByRole("textbox", { name: en.guestJoin.codeLabel }), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.verifyButton }));

    await waitFor(() => expect(harness.push).toHaveBeenCalled());
    expect(auth.verifyEmailOtp).toHaveBeenCalledWith("jean@example.test", "12345678");
    expect(harness.rpc).toHaveBeenCalledWith("claim_guest_access", { p_guest_id: "g-1" });
    expect(harness.push.mock.calls[0]?.[0]).toContain("guest-token");
  });

  it("says so when nobody matches, and starts over on request", async () => {
    const input = await openForm();
    fireEvent.change(input, { target: { value: "nobody@example.test" } });
    submit();

    await screen.findByRole("heading", { name: en.guestJoin.noMatchTitle });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.tryAgainButton }));
    expect(await screen.findByRole("heading", { name: en.guestJoin.title })).toBeInTheDocument();
  });
});
