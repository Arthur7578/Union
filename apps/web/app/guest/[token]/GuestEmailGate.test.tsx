// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { en } from "@/lib/i18n/dictionaries/en";

/** The e-mail step, asked like every guest form: address, then code. */

const harness = vi.hoisted(() => ({
  sendEmailOtp: vi.fn<(email: string, captcha?: string) => Promise<void>>(() => Promise.resolve()),
  verifyEmailOtp: vi.fn<(email: string, code: string) => Promise<void>>(() => Promise.resolve()),
  rpc: vi.fn(() => Promise.resolve({ data: { status: "verified" }, error: null })),
}));

vi.mock("@/lib/auth", () => ({
  sendEmailOtp: harness.sendEmailOtp,
  verifyEmailOtp: harness.verifyEmailOtp,
}));
vi.mock("@/lib/turnstile", () => ({
  useTurnstile: () => ({ captcha: null, getCaptchaToken: () => Promise.resolve(undefined) }),
}));
vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({
    rpc: harness.rpc,
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  }),
}));

import { GuestEmailGate } from "./GuestEmailGate";

const copy = en.guestEmailSetup;
const enter = () => fireEvent.keyDown(window, { key: "Enter" });

function open() {
  return render(
    <LocaleProvider initialLocale="en">
      <GuestEmailGate token="tok" guestId="g-1" guestName="Claire Martin" emailMissing>
        <p>the hub</p>
      </GuestEmailGate>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  harness.sendEmailOtp.mockClear();
  harness.sendEmailOtp.mockImplementation(() => Promise.resolve());
  harness.verifyEmailOtp.mockClear();
  harness.rpc.mockClear();
});
afterEach(cleanup);

describe("GuestEmailGate", () => {
  it("sends a code to the address, then verifies it and opens the hub", async () => {
    open();
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: copy.emailLabel }), {
      target: { value: "claire@example.com" },
    });
    enter();

    expect(await screen.findByRole("heading", { name: copy.codeTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.codeSent("claire@example.com"))).toBeInTheDocument();
    expect(harness.sendEmailOtp).toHaveBeenCalledWith("claire@example.com", undefined);

    fireEvent.change(screen.getByRole("textbox", { name: copy.codeLabel }), { target: { value: "12345678" } });
    enter();

    expect(await screen.findByText("the hub")).toBeInTheDocument();
    expect(harness.verifyEmailOtp).toHaveBeenCalledWith("claire@example.com", "12345678");
    expect(harness.rpc).toHaveBeenCalledWith("complete_guest_email_setup", { p_token: "tok" });
  });

  it("stays on the address, with the reason, when the code can't be sent", async () => {
    harness.sendEmailOtp.mockImplementation(() => Promise.reject(new Error("rate limited")));
    open();
    fireEvent.change(screen.getByRole("textbox", { name: copy.emailLabel }), {
      target: { value: "claire@example.com" },
    });
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.sendError);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
  });

  it("does not ask for anything when the guest already has an address", () => {
    render(
      <LocaleProvider initialLocale="en">
        <GuestEmailGate token="tok" guestId="g-1" guestName="Claire Martin" emailMissing={false}>
          <p>the hub</p>
        </GuestEmailGate>
      </LocaleProvider>,
    );
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });
});
