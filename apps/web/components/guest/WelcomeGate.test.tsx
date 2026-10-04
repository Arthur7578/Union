// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { WelcomeGate } from "./WelcomeGate";

/**
 * The invitation comes before any identity or e-mail step: the welcome shows
 * first, and only "Respond to the invitation" lets the guest through.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = vi.fn(); // jsdom does not implement it
});
afterEach(cleanup);

const gate = (props: { guestName?: string | null } = {}) => (
  <LocaleProvider initialLocale="en">
    <WelcomeGate seenId="tok" partnerOne="Maya" partnerTwo="Daniel" {...props}>
      <p>the hub</p>
    </WelcomeGate>
  </LocaleProvider>
);

const respond = () => screen.getByRole("button", { name: "Respond to the invitation" });

describe("WelcomeGate", () => {
  it("shows the invitation first, then lets the guest through", () => {
    render(gate());
    expect(screen.queryByText("the hub")).not.toBeInTheDocument();
    fireEvent.click(respond());
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });

  it("greets a named guest, and a group link without a name", () => {
    render(gate({ guestName: "Claire" }));
    expect(screen.getByText("For Claire")).toBeInTheDocument();
    cleanup();
    render(gate());
    expect(screen.getByText("Invitation")).toBeInTheDocument();
  });

  it("skips the welcome once it has been seen", () => {
    render(gate());
    fireEvent.click(respond());
    cleanup();
    render(gate());
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });
});
