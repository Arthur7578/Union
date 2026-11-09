import type { DBInvitation } from "./page";

/**
 * An invitation read through a real guest link, turned into a first visit by
 * a guest of that name: no reply yet, no companions, no answers to any form,
 * the faire-part not seen, and nothing reserved for a yes (the shuttle). What
 * the couple wrote and what the wedding discloses stay as the server sent them.
 */
export function asFirstVisit(invitation: DBInvitation, guestName: string): DBInvitation {
  const clearForm = <F extends { answers: unknown; companion_answers?: unknown } | null | undefined>(form: F): F =>
    form ? { ...form, answers: null, companion_answers: {} } : form;
  return {
    ...invitation,
    guest: {
      ...invitation.guest,
      first_name: guestName,
      last_name: null,
      rsvp_status: "pending",
      dietary_notes: null,
      message: null,
      welcome_seen_at: null,
    } as DBInvitation["guest"],
    companions: [],
    self_merge_candidates: [],
    rsvp_form: clearForm(invitation.rsvp_form),
    rsvp_reconfirmation: clearForm(invitation.rsvp_reconfirmation),
    custom_forms: (invitation.custom_forms ?? []).map((f) => ({ ...f, answers: null, companion_answers: {} })),
    guest_page: invitation.guest_page
      ? {
          ...invitation.guest_page,
          page: invitation.guest_page.page ? { ...invitation.guest_page.page, shuttle: null } : null,
        }
      : invitation.guest_page,
  };
}
