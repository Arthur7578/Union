// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_GUEST_PAGE, type GuestPageContent } from "@union/shared";
import { LocaleProvider } from "@/lib/i18n/client";
import { FaqSection } from "./FaqSection";
import { LogisticsSection } from "./LogisticsSection";

afterEach(cleanup);

const content: GuestPageContent = {
  page: {
    welcome: null,
    travel_train: { fr: "Gare d'Avignon TGV, puis 45 min.", en: "Avignon TGV, then 45 min." },
    travel_plane: null,
    travel_car: { fr: "Parking gratuit." },
    shuttle: null,
    dress_code: { fr: "Chic champêtre" },
    dress_text: { fr: "Lin et couleurs douces." },
    dress_note: null,
    palette: [],
  },
  moments: [
    { id: "c", day_offset: 0, starts_at: "16:30", title: { fr: "La cérémonie" }, place: { fr: "Sous les oliviers" }, note: null },
    { id: "d", day_offset: -1, starts_at: "19:30", title: { fr: "Le dîner du vendredi" }, place: null, note: null },
  ],
  faq: [{ id: "q", question: { fr: "Les enfants sont-ils invités ?" }, answer: { fr: "Oui, avec joie." } }],
  stays: [{ id: "s", name: "Hôtel des Oliviers", price_note: "120 € la nuit" }],
};

const inFrench = (ui: React.ReactNode) => render(<LocaleProvider initialLocale="fr">{ui}</LocaleProvider>);

describe("LogisticsSection", () => {
  it("shows the couple's weekend, day by day, with dates from the wedding date", () => {
    inFrench(<LogisticsSection venueName="Le Mas" addressText="Gordes" eventDate="2027-06-12" content={content} />);
    const friday = screen.getByRole("heading", { name: "Vendredi 11 juin" });
    const saturday = screen.getByRole("heading", { name: "Samedi 12 juin" });
    // The day before comes first.
    expect(friday.compareDocumentPosition(saturday) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const saturdayCard = saturday.closest("li")!;
    expect(within(saturdayCard).getByText("16:30")).toBeInTheDocument();
    expect(within(saturdayCard).getByText("La cérémonie")).toBeInTheDocument();
    expect(within(saturdayCard).getByText("Sous les oliviers")).toBeInTheDocument();
  });

  it("shows how to get there and the couple's own stays, never another wedding's", () => {
    inFrench(<LogisticsSection venueName="Le Mas" addressText="Gordes" eventDate="2027-06-12" content={content} />);
    expect(screen.getByText("Gare d'Avignon TGV, puis 45 min.")).toBeInTheDocument();
    expect(screen.getByText("Parking gratuit.")).toBeInTheDocument();
    expect(screen.queryByText("En avion")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hôtel des Oliviers" })).toBeInTheDocument();
    expect(screen.queryByText(/Hood River/)).not.toBeInTheDocument();
  });

  it("names the days without a wedding date", () => {
    inFrench(<LogisticsSection venueName={null} addressText="" eventDate={null} content={content} />);
    expect(screen.getByRole("heading", { name: "La veille" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Le jour J" })).toBeInTheDocument();
  });

  it("shows only the venue when the couple wrote nothing yet", () => {
    inFrench(<LogisticsSection venueName="Le Mas" addressText="" eventDate="2027-06-12" content={EMPTY_GUEST_PAGE} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Le lieu"]);
    expect(screen.queryByText("Où dormir")).not.toBeInTheDocument();
  });

  it("shows the shuttle when the server sent it", () => {
    inFrench(
      <LogisticsSection
        venueName="Le Mas"
        addressText=""
        eventDate="2027-06-12"
        content={{ ...content, page: { ...content.page!, shuttle: { fr: "Départ 15 h" } } }}
      />,
    );
    expect(screen.getByText("La navette")).toBeInTheDocument();
    expect(screen.getByText("Départ 15 h")).toBeInTheDocument();
  });
});

describe("FaqSection", () => {
  it("shows the dress code first, then the couple's questions", () => {
    inFrench(<FaqSection content={content} />);
    const questions = screen.getAllByRole("group").map((d) => d.querySelector("summary")!.textContent);
    expect(questions).toEqual(["Quel est le dress code ?", "Les enfants sont-ils invités ?"]);
    expect(screen.getByText("Chic champêtre. Lin et couleurs douces.")).toBeInTheDocument();
  });

  it("falls back to the other language rather than showing nothing", () => {
    render(
      <LocaleProvider initialLocale="en">
        <FaqSection content={content} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Les enfants sont-ils invités ?")).toBeInTheDocument();
  });

  it("says so when there are no questions yet, instead of another wedding's answers", () => {
    inFrench(<FaqSection content={EMPTY_GUEST_PAGE} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText(/pas encore ajouté de questions/)).toBeInTheDocument();
  });
});
