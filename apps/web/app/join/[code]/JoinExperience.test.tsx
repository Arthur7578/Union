// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { arrivedThroughGroupLink } from "@/lib/groupLinkArrival";
import type { JoinWeddingPreview } from "./page";

/**
 * The group link after the welcome: a guest finds their invitation by name
 * (the last name only when several guests share the first name), then, in
 * secure mode, confirms an email with a code. Light mode opens on the name.
 * A browser already signed in picks among its own invitations.
 */

type RpcReply = { data: unknown; error: null };

const harness = vi.hoisted(() => ({
  push: vi.fn(),
  session: null as null | { user: { id: string } },
  replies: {} as Record<string, (args: Record<string, unknown>) => unknown>,
  rpc: vi.fn(),
  sendEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, replace: vi.fn() }),
}));

vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

vi.mock("@/lib/auth", () => ({
  LAST_EMAIL_KEY: "union.lastEmail",
  sendEmailOtp: harness.sendEmailOtp,
  verifyEmailOtp: harness.verifyEmailOtp,
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: harness.session } }) },
    rpc: harness.rpc,
  }),
}));

import { JoinExperience } from "./JoinExperience";

const preview = (mode: "secure" | "light"): JoinWeddingPreview => ({
  partner_one: "Maya",
  partner_two: "Daniel",
  event_date: null,
  venue_name: null,
  guest_join_auth_mode: mode,
  address_visibility: "hidden",
  address: null,
});

const reply = (fn: string, answer: (args: Record<string, unknown>) => unknown) => {
  harness.replies[fn] = answer;
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  harness.push.mockReset();
  harness.session = null;
  harness.replies = {};
  harness.sendEmailOtp.mockReset().mockResolvedValue(undefined);
  harness.verifyEmailOtp.mockReset().mockResolvedValue(undefined);
  harness.rpc.mockReset().mockImplementation(
    (fn: string, args: Record<string, unknown>): Promise<RpcReply> =>
      Promise.resolve({ data: harness.replies[fn]?.(args) ?? null, error: null }),
  );
});

afterEach(cleanup);

const rpcCalls = (fn: string) =>
  harness.rpc.mock.calls.filter(([name]) => name === fn).map(([, args]) => args);

async function typeFirstName(name: string) {
  const input = await screen.findByLabelText(en.guestJoin.firstNameLabel);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: en.guestJoin.continueButton }));
}

describe("JoinExperience, light mode", () => {
  it("opens the invitation from the name alone", async () => {
    reply("find_guest_for_join", () => ({ status: "match", mode: "light", token: "tok-julie" }));
    render(<JoinExperience code="abc" preview={preview("light")} />);

    await typeFirstName("Julie");

    await waitFor(() => expect(harness.push).toHaveBeenCalledWith("/guest/tok-julie"));
    expect(rpcCalls("find_guest_for_join")[0]).toMatchObject({
      p_join_code: "abc",
      p_first_name: "Julie",
      p_last_name: null,
    });
    expect(arrivedThroughGroupLink("tok-julie")).toBe(true);
    expect(harness.sendEmailOtp).not.toHaveBeenCalled();
  });

  it("asks the last name only when the first name is shared", async () => {
    reply("find_guest_for_join", (args) =>
      args.p_last_name
        ? { status: "match", mode: "light", token: "tok-zaza-d" }
        : { status: "needs_last_name" },
    );
    render(<JoinExperience code="abc" preview={preview("light")} />);

    await typeFirstName("Zaza");
    expect(await screen.findByText(en.guestJoin.lastNameSubtitle("Zaza"))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.guestJoin.lastNameLabel), {
      target: { value: "Durand" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.continueButton }));

    await waitFor(() => expect(harness.push).toHaveBeenCalledWith("/guest/tok-zaza-d"));
    expect(rpcCalls("find_guest_for_join")[1]).toMatchObject({
      p_first_name: "Zaza",
      p_last_name: "Durand",
    });
  });

  it("says when nobody matches, and when only the couple can tell guests apart", async () => {
    reply("find_guest_for_join", () => ({ status: "not_found" }));
    render(<JoinExperience code="abc" preview={preview("light")} />);
    await typeFirstName("Nobody");
    expect(await screen.findByText(en.guestJoin.notFoundTitle)).toBeInTheDocument();

    reply("find_guest_for_join", () => ({ status: "ambiguous" }));
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.tryAgainButton }));
    await typeFirstName("Tom");
    expect(await screen.findByText(en.guestJoin.ambiguousTitle)).toBeInTheDocument();
  });
});

describe("JoinExperience, secure mode", () => {
  it("confirms an email with a code before opening the invitation", async () => {
    reply("find_guest_for_join", () => ({ status: "match", mode: "secure", guest_id: "g-paul" }));
    reply("check_join_email", () => ({ status: "ok" }));
    reply("secure_guest_invitation", () => ({
      status: "verified",
      token: "tok-paul",
      first_name: "Paul",
      last_name: null,
    }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    await typeFirstName("Paul");
    expect(harness.push).not.toHaveBeenCalled();

    fireEvent.change(await screen.findByLabelText(en.guestJoin.emailLabel), {
      target: { value: "paul@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.sendCodeButton }));
    await waitFor(() => expect(harness.sendEmailOtp).toHaveBeenCalled());
    expect(harness.sendEmailOtp.mock.calls[0][0]).toBe("paul@example.test");
    expect(rpcCalls("check_join_email")[0]).toMatchObject({
      p_guest_id: "g-paul",
      p_email: "paul@example.test",
    });

    fireEvent.change(await screen.findByLabelText(en.guestJoin.codeLabel), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.verifyButton }));

    await waitFor(() => expect(harness.push).toHaveBeenCalledWith("/guest/tok-paul"));
    expect(harness.verifyEmailOtp).toHaveBeenCalledWith("paul@example.test", "12345678");
    expect(rpcCalls("secure_guest_invitation")[0]).toMatchObject({
      p_join_code: "abc",
      p_guest_id: "g-paul",
    });
  });

  it("sends no code when the couple has a different email for this guest", async () => {
    reply("find_guest_for_join", () => ({ status: "match", mode: "secure", guest_id: "g-marie" }));
    reply("check_join_email", () => ({ status: "email_mismatch" }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    await typeFirstName("Marie");
    fireEvent.change(await screen.findByLabelText(en.guestJoin.emailLabel), {
      target: { value: "other@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.sendCodeButton }));

    expect(await screen.findByText(en.guestJoin.emailMismatch("Maya & Daniel"))).toBeInTheDocument();
    expect(harness.sendEmailOtp).not.toHaveBeenCalled();
  });

  it("tells a second person that the invitation is already in use", async () => {
    reply("find_guest_for_join", () => ({ status: "match", mode: "secure", guest_id: "g-paul" }));
    reply("check_join_email", () => ({ status: "already_secured" }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    await typeFirstName("Paul");
    fireEvent.change(await screen.findByLabelText(en.guestJoin.emailLabel), {
      target: { value: "prank@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.guestJoin.sendCodeButton }));

    expect(await screen.findByText(en.guestJoin.alreadySecuredTitle)).toBeInTheDocument();
    expect(harness.sendEmailOtp).not.toHaveBeenCalled();
  });

  it("lets a signed-in browser pick among its own invitations, or be someone else", async () => {
    harness.session = { user: { id: "u1" } };
    reply("get_guest_access_options", () => ({
      status: "ok",
      matches: [
        { guest_id: "g-anne", first_name: "Anne", last_name: "Petit" },
        { guest_id: "g-marc", first_name: "Marc", last_name: "Petit" },
      ],
    }));
    reply("secure_guest_invitation", (args) => ({
      status: "verified",
      token: `tok-${String(args.p_guest_id)}`,
      first_name: "Marc",
      last_name: "Petit",
    }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    expect(await screen.findByText(en.guestJoin.pickTitle)).toBeInTheDocument();
    expect(screen.queryByText(/another email or phone/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marc Petit" }));
    await waitFor(() => expect(harness.push).toHaveBeenCalledWith("/guest/tok-g-marc"));
  });

  it("goes back to the name step for someone else on a shared device", async () => {
    harness.session = { user: { id: "u1" } };
    reply("get_guest_access_options", () => ({
      status: "ok",
      matches: [
        { guest_id: "g-anne", first_name: "Anne", last_name: null },
        { guest_id: "g-marc", first_name: "Marc", last_name: null },
      ],
    }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    fireEvent.click(await screen.findByRole("button", { name: en.guestJoin.someoneElse }));
    expect(await screen.findByLabelText(en.guestJoin.firstNameLabel)).toBeInTheDocument();
  });

  it("opens straight away when the signed-in account already secured the invitation", async () => {
    harness.session = { user: { id: "u1" } };
    reply("get_guest_access_options", () => ({
      status: "ok",
      matches: [{ guest_id: "g-paul", first_name: "Paul", last_name: null }],
    }));
    reply("secure_guest_invitation", () => ({
      status: "verified",
      token: "tok-paul",
      first_name: "Paul",
      last_name: null,
    }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    await waitFor(() => expect(harness.push).toHaveBeenCalledWith("/guest/tok-paul"));
    expect(harness.sendEmailOtp).not.toHaveBeenCalled();
  });

  it("never secures someone else's invitation with the email signed in on this device", async () => {
    harness.session = { user: { id: "organiser" } };
    reply("get_guest_access_options", () => ({ status: "ok", matches: [] }));
    reply("find_guest_for_join", () => ({ status: "match", mode: "secure", guest_id: "g-julie" }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);

    await typeFirstName("Julie");

    expect(await screen.findByLabelText(en.guestJoin.emailLabel)).toBeInTheDocument();
    expect(rpcCalls("secure_guest_invitation")).toHaveLength(0);
  });

  it("asks to wait when there have been too many attempts", async () => {
    reply("find_guest_for_join", () => ({ status: "rate_limited" }));
    render(<JoinExperience code="abc" preview={preview("secure")} />);
    await typeFirstName("Paul");
    expect(await screen.findByText(en.guestJoin.rateLimited)).toBeInTheDocument();
  });
});
