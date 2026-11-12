import { describe, expect, it } from "vitest";
import type { DBInvitation } from "./page";
import { asFirstVisit } from "./previewInvitation";

const real = {
  wedding: { partner_one: "Arthur", partner_two: "Margot", venue_name: "Le Mas", address_visibility: "area" },
  guest: { id: "g", first_name: "Paul", last_name: "Durand", rsvp_status: "attending", welcome_seen_at: "2026-11-01T10:00:00Z", dietary_notes: "Sans gluten" },
  companions: [{ id: "c", first_name: "Julie" }],
  self_merge_candidates: [],
  permissions: { can_add_partner: false, can_add_kids: false, kids_remaining: 0 },
  rsvp_form: { id: "f", answers: { q: "o" }, companion_answers: { c: { q: "o" } }, questions: [] },
  rsvp_reconfirmation: null,
  custom_forms: [{ id: "x", answers: { a: 1 }, companion_answers: { c: { a: 1 } } }],
  guest_page: { page: { welcome: { fr: "Le mot" }, shuttle: { fr: "Départ 15 h" } }, moments: [], faq: [], stays: [] },
} as unknown as DBInvitation;

describe("the organiser's preview, as a first visit", () => {
  const preview = asFirstVisit(real, "Camille");

  it("is a guest who has not replied, nor seen the faire-part", () => {
    expect(preview.guest.first_name).toBe("Camille");
    expect(preview.guest.last_name).toBeNull();
    expect(preview.guest.rsvp_status).toBe("pending");
    expect(preview.guest.welcome_seen_at).toBeNull();
    expect(preview.companions).toEqual([]);
  });

  it("carries none of the real guest's answers", () => {
    expect(preview.rsvp_form?.answers).toBeNull();
    expect(preview.rsvp_form?.companion_answers).toEqual({});
    expect(preview.custom_forms?.[0].answers).toBeNull();
    expect(JSON.stringify(preview)).not.toMatch(/Paul|Julie|Sans gluten/);
  });

  it("holds back what waits for a yes, and keeps what the couple wrote and disclosed", () => {
    expect(preview.guest_page?.page?.shuttle).toBeNull();
    expect(preview.guest_page?.page?.welcome).toEqual({ fr: "Le mot" });
    expect(preview.wedding.venue_name).toBe("Le Mas");
  });
});
