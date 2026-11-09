import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { organiserRsvpStatus, previewRsvpNote } from "./rsvpNotes";

/**
 * What the couple is told about their RSVP's window: on Guests › Guest
 * experience, and in "see as a guest". Dates as a couple in Paris reads them.
 */
const original = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  process.env.TZ = original;
});

const fr = getDictionary("fr").guests.modules;
const en = getDictionary("en").guests.modules;
// Picked as "29 octobre" and "12 mai" in the form builder: the start of those days, Paris time.
const closedForm = { published: true, closes_at: "2026-10-28T23:00:00.000Z" };
const openForm = { published: true, closes_at: "2027-05-11T22:00:00.000Z" };
const scheduledForm = { published: true, opens_at: "2027-01-09T23:00:00.000Z" };

describe("the Your reply row, for each state of the RSVP", () => {
  it("open: until when, with an ordinary Edit link", () => {
    expect(organiserRsvpStatus(openForm, "live", "fr", fr)).toEqual({
      text: "Ouvert · réponses avant le 12 mai",
      tone: "on",
      blocked: false,
    });
    expect(organiserRsvpStatus({ published: true }, "live", "fr", fr).text).toBe("Ouvert");
  });

  it("closed: since when, that guests can no longer reply, and the way to the dates", () => {
    expect(organiserRsvpStatus(closedForm, "closed", "fr", fr)).toEqual({
      text: "Clos depuis le 29 octobre : vos invités ne peuvent plus répondre",
      tone: "warn",
      blocked: true,
    });
    expect(organiserRsvpStatus(closedForm, "closed", "en", en).text).toBe(
      "Closed since October 29: your guests can no longer reply",
    );
  });

  it("not open yet: from when, and the way to the dates", () => {
    expect(organiserRsvpStatus(scheduledForm, "scheduled", "fr", fr)).toEqual({
      text: "Ouvre le 10 janvier : vos invités ne peuvent pas encore répondre",
      tone: "warn",
      blocked: true,
    });
  });

  it("unpublished: that guests don't see the card at all", () => {
    expect(organiserRsvpStatus({ published: false }, "draft", "fr", fr)).toEqual({
      text: "Non publié : vos invités ne voient pas la carte RSVP",
      tone: "warn",
      blocked: true,
    });
  });

  it("while the form loads, or without one: the reply is simply always there", () => {
    expect(organiserRsvpStatus(null, null, "fr", fr)).toEqual({ text: "Toujours", tone: "on", blocked: false });
  });
});

describe("the preview's note on the RSVP card", () => {
  it("says nothing while guests can reply", () => {
    expect(previewRsvpNote("live", openForm, "fr", fr)).toBeNull();
  });

  it("says why there is nothing to press: closed, not open yet, unpublished", () => {
    expect(previewRsvpNote("closed", closedForm, "fr", fr)).toBe(
      "Les réponses sont closes depuis le 29 octobre : vos invités voient la carte RSVP sans pouvoir répondre.",
    );
    expect(previewRsvpNote("scheduled", scheduledForm, "fr", fr)).toBe(
      "Les réponses ouvrent le 10 janvier : d'ici là, vos invités voient la carte RSVP sans pouvoir répondre.",
    );
    expect(previewRsvpNote("hidden", { published: false }, "fr", fr)).toBe(
      "Le formulaire RSVP n'est pas publié : vos invités ne voient pas la carte RSVP.",
    );
  });
});
