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
  const front = () => document.querySelector(".recto")!;
  const back = () => document.querySelector(".verso")!;

  it("shows the couple, the date in the guest's language and the zone on the front", () => {
    welcome({ eventDate: "2027-06-12", zone: { kind: "area", name: "Provence" } });
    expect(screen.getByRole("heading", { level: 2, hidden: true })).toHaveTextContent(/Maya\s*&\s*Daniel/);
    expect(front()).toHaveTextContent("are delighted to invite you to celebrate their wedding");
    expect(screen.getByText("June 12, 2027")).toBeInTheDocument();
    expect(screen.getByText("In Provence ♡")).toBeInTheDocument();
  });

  it("writes the front in French, with a range of days", () => {
    welcome({ eventDate: "2027-06-11", eventEndDate: "2027-06-13", zone: { kind: "area", name: "Provence" } }, "fr");
    expect(front()).toHaveTextContent("ont la joie de t'inviter à célébrer leur mariage");
    expect(screen.getByText("11 — 13 juin 2027")).toBeInTheDocument();
    expect(screen.getByText("En Provence ♡")).toBeInTheDocument();
  });

  it("names the city when there is no area", () => {
    welcome({ eventDate: "2027-06-12", zone: { kind: "city", name: "Trets" } }, "fr");
    expect(screen.getByText("À Trets ♡")).toBeInTheDocument();
  });

  it("greets a named guest, and writes the invitation to them", () => {
    welcome(
      { guestName: "Léa", eventDate: "2027-06-11", eventEndDate: "2027-06-13", zone: { kind: "area", name: "Provence" } },
      "fr",
    );
    expect(back().textContent).toBe(
      [
        "Cher(e) Léa,",
        "Il y a des moments que l'on a particulièrement envie de partager avec les personnes qui comptent pour nous.",
        "Nous serions très heureux de te retrouver en Provence, du 11 au 13 juin 2027, pour célébrer notre mariage et partager trois jours de fête, de joie et de beaux souvenirs.",
        "Nous espérons de tout cœur que tu pourras être des nôtres. Nous avons hâte de vivre ces beaux moments avec toi.",
        "Avec toute notre affection,",
        "Maya & Daniel",
      ].join(""),
    );
  });

  it("greets everyone on a group link, where no guest is named", () => {
    welcome({}, "fr");
    expect(back()).toHaveTextContent("Chers amis,");
    expect(back()).not.toHaveTextContent("Cher(e)");
  });

  it("leaves out what is not known, without leaving a gap in the sentence", () => {
    welcome({ eventDate: "2027-06-12" }, "fr");
    expect(back()).toHaveTextContent(
      "Nous serions très heureux de te retrouver le 12 juin 2027 pour célébrer notre mariage et partager une journée de fête",
    );
    cleanup();
    welcome({ zone: { kind: "city", name: "Trets" } }, "fr");
    expect(back()).toHaveTextContent(
      "Nous serions très heureux de te retrouver à Trets pour célébrer notre mariage et partager des moments de fête",
    );
    cleanup();
    welcome({}, "fr");
    expect(back()).toHaveTextContent("Nous serions très heureux de te retrouver pour célébrer notre mariage");
  });

  it("shows no date or zone line when none is disclosed", () => {
    welcome({});
    expect(document.querySelector(".when")).toBeNull();
    expect(document.querySelector(".where")).toBeNull();
  });

  it("leaves out a missing partner without a dangling ampersand", () => {
    welcome({ partnerTwo: null });
    expect(screen.getByRole("heading", { level: 2, hidden: true })).not.toHaveTextContent("&");
    expect(document.querySelector(".sign")).toHaveTextContent("Maya");
    expect(document.querySelector(".sign")).not.toHaveTextContent("&");
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
