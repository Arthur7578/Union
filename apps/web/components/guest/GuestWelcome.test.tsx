// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { GuestWelcome } from "./GuestWelcome";

/**
 * What the faire-part card says comes from the invitation, and only from it:
 * the couple, the date in the guest's language, and the place as disclosed.
 */

beforeEach(() => {
  window.scrollTo = vi.fn(); // jsdom does not implement it
});
afterEach(cleanup);

const welcome = (props: Partial<React.ComponentProps<typeof GuestWelcome>>, locale: "en" | "fr" = "en") =>
  render(
    <LocaleProvider initialLocale={locale}>
      <GuestWelcome partnerOne="Maya" partnerTwo="Daniel" onRespond={() => {}} {...props} />
    </LocaleProvider>,
  );

describe("GuestWelcome", () => {
  // jsdom has no layout, so the sequence sits at its end: the card shows its back and
  // the front is hidden. Queries below reach hidden elements on purpose.
  it("shows the couple, the date in the guest's language and the place", () => {
    welcome({ eventDate: "2027-06-12", venueName: "Wildflower Barn", address: "Hood River" });
    expect(screen.getByRole("heading", { level: 2, hidden: true })).toHaveTextContent(/Maya\s*&\s*Daniel/);
    expect(screen.getByText("June 12, 2027")).toBeInTheDocument();
    expect(screen.getByText("Wildflower Barn")).toBeInTheDocument();
    expect(screen.getByText("Wildflower Barn, Hood River")).toBeInTheDocument();
  });

  it("formats the date in French for a French guest", () => {
    welcome({ eventDate: "2027-06-12" }, "fr");
    expect(screen.getByText("12 juin 2027")).toBeInTheDocument();
  });

  it("falls back to the address when the venue name is withheld", () => {
    welcome({ venueName: null, address: "Provence, France" });
    expect(screen.getAllByText("Provence, France").length).toBeGreaterThan(0);
  });

  it("shows no date or place line when none is disclosed", () => {
    welcome({});
    expect(document.querySelector(".when")).toBeNull();
    expect(document.querySelector(".where")).toBeNull();
    expect(document.querySelector(".foot")).toBeNull();
  });

  it("leaves out a missing partner without a dangling ampersand", () => {
    welcome({ partnerTwo: null });
    expect(screen.getByRole("heading", { level: 2, hidden: true })).not.toHaveTextContent("&");
  });

  it("carries no prototype sample data", () => {
    welcome({});
    for (const sample of ["Margot", "Trets", "Pommé", "Pétanque", "2027"]) {
      expect(document.body.textContent).not.toContain(sample);
    }
  });

  it("calls onRespond from the button once the sequence has played", () => {
    const onRespond = vi.fn();
    welcome({ onRespond });
    fireEvent.click(screen.getByRole("button", { name: "Respond to the invitation" }));
    expect(onRespond).toHaveBeenCalledTimes(1);
  });

  it("offers a way to skip the animation and to switch language", () => {
    welcome({});
    expect(screen.getByText("Skip")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
  });
});
