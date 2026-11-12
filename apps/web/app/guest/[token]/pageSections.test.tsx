// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GUEST_PAGE, type GuestPageContent } from "@union/shared";
import { LocaleProvider } from "@/lib/i18n/client";
import { DressSection } from "./DressSection";
import { FaqSection } from "./FaqSection";
import { ReplyDock } from "./ReplyDock";
import { ReplySection } from "./ReplySection";
import { VenueSection } from "./VenueSection";
import { WeekendSection } from "./WeekendSection";
import { WordSection } from "./WordSection";

afterEach(cleanup);

const content: GuestPageContent = {
  page: {
    welcome: { fr: "Il y a huit ans, une table trop petite.\n\nAlors on a choisi la Provence." },
    travel_train: { fr: "Gare d'Avignon TGV, puis 45 min.", en: "Avignon TGV, then 45 min." },
    travel_plane: null,
    travel_car: { fr: "Parking gratuit." },
    shuttle: null,
    dress_code: { fr: "Chic champêtre" },
    dress_text: { fr: "Lin et couleurs douces." },
    dress_note: { fr: "Le blanc, on le laisse à Margot." },
    palette: [{ color: "#A4AE8F", name: { fr: "Sauge" } }, { color: "#5D6A3E" }],
  },
  moments: [
    { id: "c", day_offset: 0, starts_at: "16:30", title: { fr: "La cérémonie" }, place: { fr: "Sous les oliviers" }, note: null },
    { id: "d", day_offset: -1, starts_at: "19:30", title: { fr: "Le dîner du vendredi" }, place: null, note: null },
  ],
  faq: [{ id: "q", question: { fr: "Les enfants sont-ils invités ?" }, answer: { fr: "Oui, avec joie." } }],
  stays: [{ id: "s", name: "Hôtel des Oliviers", price_note: "120 € la nuit" }],
};

const inFrench = (ui: React.ReactNode) => render(<LocaleProvider initialLocale="fr">{ui}</LocaleProvider>);

describe("WordSection", () => {
  it("shows the couple's word in paragraphs, signed with their names, and the countdown", () => {
    inFrench(<WordSection content={content} coupleNames="Arthur & Margot" daysLeft={222} />);
    expect(screen.getByText("Il y a huit ans, une table trop petite.")).toBeInTheDocument();
    expect(screen.getByText("Alors on a choisi la Provence.")).toBeInTheDocument();
    expect(screen.getByText("Arthur & Margot")).toBeInTheDocument();
    expect(screen.getByText("222")).toBeInTheDocument();
    expect(screen.getByText("jours avant de lever nos verres")).toBeInTheDocument();
  });

  it("has no countdown without a date", () => {
    inFrench(<WordSection content={content} coupleNames="Arthur & Margot" daysLeft={null} />);
    expect(screen.queryByText(/lever nos verres/)).not.toBeInTheDocument();
  });
});

describe("WeekendSection", () => {
  const weekend = (eventDate: string | null) => (
    <WeekendSection content={content} eventDate={eventDate} venueName="Le Mas" calendarName="Arthur & Margot" />
  );

  it("shows the couple's weekend, day by day, with dates from the wedding date", () => {
    inFrench(weekend("2027-06-12"));
    const friday = screen.getByRole("heading", { name: "Vendredi 11 juin" });
    const saturday = screen.getByRole("heading", { name: "Samedi 12 juin" });
    // The day before comes first.
    expect(friday.compareDocumentPosition(saturday) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const saturdayDay = screen.getByRole("region", { name: "Samedi 12 juin" });
    expect(within(saturdayDay).getByText("16:30")).toBeInTheDocument();
    expect(within(saturdayDay).getByText("La cérémonie")).toBeInTheDocument();
    expect(within(saturdayDay).getByText("Sous les oliviers")).toBeInTheDocument();
  });

  it("names the days without a wedding date, and offers no calendar then", () => {
    inFrench(weekend(null));
    expect(screen.getByRole("heading", { name: "La veille" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Le jour J" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter à mon agenda" })).not.toBeInTheDocument();
  });

  it("adds the ticked moments to a calendar, and Google one at a time", () => {
    inFrench(weekend("2027-06-12"));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter à mon agenda" }));
    const sheet = screen.getByRole("dialog", { name: "Dans mon agenda" });
    // Both ticked: the file takes them all, Google can't.
    expect(within(sheet).getByRole("button", { name: "Apple Calendrier ou Outlook" })).toBeEnabled();
    expect(within(sheet).getByRole("button", { name: "Google Agenda" })).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /Le dîner du vendredi/ }));
    const google = within(sheet).getByRole("link", { name: "Google Agenda" });
    expect(new URL(google.getAttribute("href")!).searchParams.get("text")).toBe("La cérémonie");
    // Nothing ticked: nothing to add.
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /La cérémonie/ }));
    expect(within(sheet).getByRole("button", { name: "Apple Calendrier ou Outlook" })).toBeDisabled();
    expect(within(sheet).getByText("Coche au moins un moment.")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("VenueSection", () => {
  it("shows how to get there and the couple's own stays, never another wedding's", () => {
    inFrench(<VenueSection venueName="Le Mas" addressText="Gordes" content={content} />);
    expect(screen.getByText("Gare d'Avignon TGV, puis 45 min.")).toBeInTheDocument();
    expect(screen.getByText("Parking gratuit.")).toBeInTheDocument();
    expect(screen.queryByText("En avion")).not.toBeInTheDocument();
    expect(screen.getByText("Hôtel des Oliviers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", expect.stringContaining("Le%20Mas%2C%20Gordes"));
    expect(screen.queryByText(/Hood River/)).not.toBeInTheDocument();
  });

  it("shows only the venue when the couple wrote nothing yet, and says the address is coming", () => {
    inFrench(<VenueSection venueName="Le Mas" addressText="" content={EMPTY_GUEST_PAGE} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Le Mas"]);
    expect(screen.getByText("L'adresse complète sera communiquée prochainement.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Google Maps" })).not.toBeInTheDocument();
  });

  it("shows the shuttle when the server sent it", () => {
    inFrench(
      <VenueSection
        venueName="Le Mas"
        addressText=""
        content={{ ...content, page: { ...content.page!, shuttle: { fr: "Départ 15 h" } } }}
      />,
    );
    expect(screen.getByText("La navette")).toBeInTheDocument();
    expect(screen.getByText("Départ 15 h")).toBeInTheDocument();
    expect(screen.getByText("Visible parce que tu viens.")).toBeInTheDocument();
  });
});

describe("DressSection", () => {
  it("shows the dress code, its word, the palette and the last line", () => {
    inFrench(<DressSection content={content} />);
    expect(screen.getByText("Chic champêtre")).toBeInTheDocument();
    expect(screen.getByText("Lin et couleurs douces.")).toBeInTheDocument();
    const palette = screen.getByRole("list", { name: "La palette" });
    expect(within(palette).getAllByRole("listitem")).toHaveLength(2);
    expect(within(palette).getByText("Sauge")).toBeInTheDocument();
    expect(screen.getByText("Le blanc, on le laisse à Margot.")).toBeInTheDocument();
  });
});

describe("FaqSection", () => {
  it("shows the couple's questions, and leaves the dress code to La tenue", () => {
    inFrench(<FaqSection content={content} />);
    const questions = screen.getAllByRole("group").map((d) => d.querySelector("summary")!.textContent);
    expect(questions).toEqual(["Les enfants sont-ils invités ?"]);
    expect(screen.queryByText(/Chic champêtre/)).not.toBeInTheDocument();
  });

  it("falls back to the other language rather than showing nothing", () => {
    render(
      <LocaleProvider initialLocale="en">
        <FaqSection content={content} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Les enfants sont-ils invités ?")).toBeInTheDocument();
  });
});

describe("ReplySection", () => {
  const labels = { attending: "Oui, avec joie", maybe: "Peut-être", declined: "Non, avec regret" };
  const reply = (over: Partial<React.ComponentProps<typeof ReplySection>> = {}) => {
    const onAnswer = vi.fn();
    const onEdit = vi.fn();
    inFrench(
      <ReplySection
        window="live"
        status="pending"
        title="RSVP de Présence"
        summary="Dis-nous si tu viens."
        labels={labels}
        allowMaybe
        opensAt={null}
        closesAt="2027-05-12T21:59:59.000Z"
        onAnswer={onAnswer}
        onEdit={onEdit}
        otherForms={[]}
        {...over}
      />,
    );
    return { onAnswer, onEdit };
  };

  it("offers the couple's answers, with their title, subtitle and the deadline, and hands the one picked on", () => {
    const { onAnswer } = reply();
    expect(screen.getByRole("heading", { name: "RSVP de Présence" })).toBeInTheDocument();
    expect(screen.getByText("Dis-nous si tu viens.")).toBeInTheDocument();
    expect(screen.getByText("Merci de répondre jusqu'au 12 mai")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Peut-être" }));
    expect(onAnswer).toHaveBeenCalledWith("maybe");
  });

  it("offers no maybe when the couple doesn't", () => {
    reply({ allowMaybe: false });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Oui, avec joie", "Non, avec regret"]);
  });

  it("thanks a guest who replied, with their answer and a way to change it", () => {
    const { onEdit } = reply({ status: "attending", summary: "Oui, avec joie" });
    expect(screen.getByRole("heading", { name: "Bien reçu" })).toBeInTheDocument();
    expect(screen.getByText("Merci !")).toBeInTheDocument();
    expect(screen.getByText("Oui, avec joie")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifier ma réponse" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("says replies are closed after the deadline, with nothing to press", () => {
    reply({ window: "closed" });
    expect(screen.getByText("Les réponses sont closes depuis le 12 mai")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("drops the couple's call to reply once replies are closed, and says what to do instead", () => {
    reply({ window: "closed", coupleNames: "Arthur & Margot" });
    expect(screen.queryByText("Dis-nous si tu viens.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Un imprévu ou une bonne nouvelle ? Préviens directement Arthur & Margot."),
    ).toBeInTheDocument();
  });

  it("drops the call to reply before replies open too", () => {
    reply({ window: "scheduled", opensAt: "2027-01-10" });
    expect(screen.getByText("Les réponses ouvrent le 10 janvier")).toBeInTheDocument();
    expect(screen.queryByText("Dis-nous si tu viens.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ReplySection, once a guest who is coming has replied", () => {
  const labels = { attending: "Oui, avec joie", maybe: "Peut-être", declined: "Non, avec regret" };
  const moment = { id: "m", date: "2027-06-12", startsAt: "16:30", title: "La cérémonie" };
  const replied = (over: Partial<React.ComponentProps<typeof ReplySection>> = {}) =>
    inFrench(
      <ReplySection
        window="live"
        status="attending"
        title="RSVP de Présence"
        summary="Oui, avec joie"
        labels={labels}
        allowMaybe
        opensAt={null}
        closesAt="2027-05-12T21:59:59.000Z"
        onAnswer={() => {}}
        onEdit={() => {}}
        otherForms={[]}
        {...over}
      />,
    );

  it("offers the weekend in a calendar and the carpool board", () => {
    const onCarpool = vi.fn();
    replied({ weekend: [moment], calendarName: "Arthur & Margot", onCarpool });
    fireEvent.click(screen.getByRole("button", { name: "Trouver un covoiturage" }));
    expect(onCarpool).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter le week-end à mon agenda" }));
    expect(screen.getByRole("dialog", { name: "Dans mon agenda" })).toBeInTheDocument();
  });

  it("offers only what the page has", () => {
    replied({ weekend: [], onCarpool: undefined });
    expect(screen.queryByRole("button", { name: /agenda|covoiturage/ })).not.toBeInTheDocument();
  });

  it("offers neither to a guest who is not coming, nor to a maybe", () => {
    replied({ status: "declined", weekend: [moment], onCarpool: () => {} });
    expect(screen.queryByRole("button", { name: /agenda|covoiturage/ })).not.toBeInTheDocument();
    cleanup();
    replied({ status: "maybe", weekend: [moment], onCarpool: () => {} });
    expect(screen.queryByRole("button", { name: /agenda|covoiturage/ })).not.toBeInTheDocument();
  });
});

describe("ReplyDock, the reply fixed at the bottom", () => {
  const dock = (over: Partial<React.ComponentProps<typeof ReplyDock>> = {}) => {
    const onReply = vi.fn();
    inFrench(<ReplyDock window="live" status="pending" closesAt="2027-05-12T21:59:59.000Z" away={false} onReply={onReply} {...over} />);
    return onReply;
  };

  it("asks for a reply, with the deadline", () => {
    const onReply = dock();
    fireEvent.click(screen.getByRole("button", { name: "Répondre · jusqu'au 12 mai" }));
    expect(onReply).toHaveBeenCalled();
  });

  it("says where each answer stands, and what comes next", () => {
    dock({ status: "attending" });
    expect(screen.getByText("Tu seras des nôtres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
    cleanup();
    dock({ status: "maybe" });
    expect(screen.getByText("Peut-être · à confirmer jusqu'au 12 mai")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer" })).toBeInTheDocument();
    cleanup();
    dock({ status: "declined" });
    expect(screen.getByText("Tu ne pourras pas venir")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Changer d'avis" })).toBeInTheDocument();
  });

  it("says replies are closed, with nothing to press", () => {
    dock({ window: "closed" });
    expect(screen.getByText("Réponses closes depuis le 12 mai")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    cleanup();
    dock({ window: "closed", status: "attending" });
    expect(screen.getByText("Tu seras des nôtres")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("steps aside, out of reach, while the card is on screen", () => {
    dock({ away: true });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
