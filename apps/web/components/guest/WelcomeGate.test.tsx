// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { WelcomeGate, useReplayWelcome } from "./WelcomeGate";

/**
 * The invitation comes before any identity or e-mail step: the welcome shows
 * first, and only "Respond to the invitation" lets the guest through. It is
 * translated, offers the language switcher from the start, and is remembered
 * on the guest (personal link) or on the device (group link).
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ rpc: harness.rpc }),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = vi.fn(); // jsdom does not implement it
  harness.rpc.mockClear();
});
afterEach(cleanup);

function Hub() {
  const replay = useReplayWelcome();
  return (
    <div>
      <p>the hub</p>
      {replay && <button onClick={replay}>replay</button>}
    </div>
  );
}

type Gate = Partial<React.ComponentProps<typeof WelcomeGate>>;
const gate = (props: Gate = {}, locale: "en" | "fr" = "en") => (
  <LocaleProvider initialLocale={locale}>
    <WelcomeGate partnerOne="Maya" partnerTwo="Daniel" {...props}>
      <Hub />
    </WelcomeGate>
  </LocaleProvider>
);

const respond = (name = "Respond to the invitation") => screen.getByRole("button", { name });

describe("WelcomeGate", () => {
  it("shows the invitation first, then lets the guest through", () => {
    render(gate({ token: "tok", seen: false }));
    expect(screen.queryByText("the hub")).not.toBeInTheDocument();
    fireEvent.click(respond());
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });

  it("skips the welcome for a guest who has already seen it", () => {
    render(gate({ token: "tok", seen: true }));
    expect(screen.getByText("the hub")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respond to the invitation" })).not.toBeInTheDocument();
  });

  it("lets the hub replay the welcome, and come back", () => {
    render(gate({ token: "tok", seen: true }));
    fireEvent.click(screen.getByRole("button", { name: "replay" }));
    expect(screen.queryByText("the hub")).not.toBeInTheDocument();
    fireEvent.click(respond());
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });

  it("records on the guest that the welcome was seen", () => {
    render(gate({ token: "tok", seen: false }));
    fireEvent.click(respond());
    expect(harness.rpc).toHaveBeenCalledWith("mark_welcome_seen", { p_token: "tok" });
  });

  it("records nothing for the demo guest", () => {
    render(gate({ token: "demo", isDemo: true, seen: false }));
    fireEvent.click(respond());
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("greets a named guest, and a group link without a name", () => {
    render(gate({ token: "tok", seen: false, guestName: "Claire" }));
    expect(screen.getByText("For Claire")).toBeInTheDocument();
    cleanup();
    render(gate({ deviceId: "join.abc" }));
    expect(screen.getByText("Invitation")).toBeInTheDocument();
  });

  it("remembers a group-link visitor on this device only", () => {
    render(gate({ deviceId: "join.abc" }));
    fireEvent.click(respond());
    expect(harness.rpc).not.toHaveBeenCalled();
    cleanup();
    render(gate({ deviceId: "join.abc" }));
    expect(screen.getByText("the hub")).toBeInTheDocument();
  });

  it("is translated, with the language switcher from the start", () => {
    render(gate({ deviceId: "join.abc" }, "fr"));
    expect(respond("Répondre à l'invitation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(respond()).toBeInTheDocument();
  });

  it("records a guest's own language pick, not the language it opened in", () => {
    render(gate({ token: "tok", seen: false }, "fr"));
    expect(harness.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(harness.rpc).toHaveBeenCalledWith("set_guest_locale", { p_token: "tok", p_locale: "en" });
  });
});
