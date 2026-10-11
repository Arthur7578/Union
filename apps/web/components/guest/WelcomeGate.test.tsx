// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { takeRsvpHandoff } from "@/lib/rsvpHandoff";
import { WelcomeGate, useReplayWelcome, useWelcomeResponses } from "./WelcomeGate";

/**
 * The invitation comes before any identity or e-mail step: the welcome shows
 * first, and only "Respond to the invitation" lets the guest through. It is
 * translated, offers the language switcher from the start, and is remembered
 * on the guest (personal link). A group link shows it on every visit.
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ rpc: harness.rpc }),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.scrollTo = vi.fn(); // jsdom does not implement it
  harness.rpc.mockClear();
});
afterEach(cleanup);

function Hub() {
  const replay = useReplayWelcome();
  const responses = useWelcomeResponses();
  // Stands in for what a guest does on the hub (a reply sent).
  const [clicks, setClicks] = useState(0);
  return (
    <div>
      <p>the hub</p>
      <p>responses: {responses}</p>
      <button onClick={() => setClicks((n) => n + 1)}>clicked {clicks}</button>
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

  it("lets the hub replay the welcome, and come back to it as it was", () => {
    render(gate({ token: "tok", seen: true }));
    fireEvent.click(screen.getByRole("button", { name: "clicked 0" }));
    fireEvent.click(screen.getByRole("button", { name: "replay" }));
    expect(screen.getByText("the hub")).not.toBeVisible();
    fireEvent.click(respond());
    expect(screen.getByText("the hub")).toBeVisible();
    expect(screen.getByRole("button", { name: "clicked 1" })).toBeInTheDocument();
  });

  it("hands over to the RSVP when the guest chooses to respond", () => {
    render(gate({ token: "tok", seen: false }));
    fireEvent.click(respond());
    expect(screen.getByText("responses: 1")).toBeInTheDocument();
    expect(takeRsvpHandoff("tok")).toBe(true);
  });

  it("hands nothing over to a guest who lands straight on the hub", () => {
    render(gate({ token: "tok", seen: true }));
    expect(screen.getByText("responses: 0")).toBeInTheDocument();
    expect(takeRsvpHandoff("tok")).toBe(false);
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
    render(gate());
    expect(screen.getByText("Invitation")).toBeInTheDocument();
  });

  it("shows a group link's welcome on every visit, whoever came before on this device", () => {
    render(gate());
    fireEvent.click(respond());
    expect(harness.rpc).not.toHaveBeenCalled();
    cleanup();
    render(gate());
    expect(respond()).toBeInTheDocument();
    expect(screen.queryByText("the hub")).not.toBeInTheDocument();
  });

  it("is translated, with the language switcher from the start", () => {
    render(gate({}, "fr"));
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
