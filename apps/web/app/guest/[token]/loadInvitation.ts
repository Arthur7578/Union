import { parseGuestPage } from "@union/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DBInvitation } from "./page";

/**
 * Everything a guest link reads, assembled into one invitation: the
 * invitation itself, its RSVP forms' questions and answers, whether the couple
 * has an email for the guest, and the couple's page content. Only reads, all
 * through the guest-link functions, so what comes back is exactly what that
 * guest may see. Used by the guest's own link (server) and by the organiser's
 * "see as a guest" preview (browser). Null when the link leads nowhere.
 */
export async function loadInvitation(
  supabase: SupabaseClient,
  token: string,
): Promise<{ invitation: DBInvitation; emailMissing: boolean } | null> {
  const [invitationResult, rsvpFormsResult, emailStatusResult, guestPageResult] = await Promise.all([
    supabase.rpc("get_invitation", { p_token: token }),
    supabase.rpc("get_invitation_rsvp_forms", { p_token: token }),
    supabase.rpc("get_guest_email_status", { p_token: token }),
    supabase.rpc("get_guest_page", { p_token: token }),
  ]);

  if (invitationResult.error || !invitationResult.data || emailStatusResult.error || !emailStatusResult.data) {
    return null;
  }
  const base = invitationResult.data as unknown as DBInvitation;
  const rsvpForms =
    !rsvpFormsResult.error && rsvpFormsResult.data
      ? (rsvpFormsResult.data as unknown as {
          primary: Pick<
            NonNullable<DBInvitation["rsvp_form"]>,
            "id" | "published" | "opens_at" | "closes_at" | "questions" | "answers" | "companion_answers"
          > | null;
          reconfirmation: Pick<
            NonNullable<DBInvitation["rsvp_reconfirmation"]>,
            "id" | "questions" | "answers" | "companion_answers"
          > | null;
        })
      : null;
  if (rsvpFormsResult.error) {
    console.error("Failed to load RSVP follow-up questions:", rsvpFormsResult.error);
  }
  if (guestPageResult.error) {
    console.error("Failed to load the guest page content:", guestPageResult.error);
  }
  const invitation: DBInvitation = {
    ...base,
    guest_page: guestPageResult.error ? undefined : parseGuestPage(guestPageResult.data),
    rsvp_form:
      base.rsvp_form && rsvpForms?.primary
        ? { ...base.rsvp_form, ...rsvpForms.primary }
        : base.rsvp_form
          ? {
              ...base.rsvp_form,
              id: "",
              published: true,
              opens_at: null,
              closes_at: null,
              questions: [],
              answers: null,
              companion_answers: {},
            }
          : null,
    rsvp_reconfirmation:
      base.rsvp_reconfirmation && rsvpForms?.reconfirmation
        ? { ...base.rsvp_reconfirmation, ...rsvpForms.reconfirmation }
        : base.rsvp_reconfirmation
          ? {
              ...base.rsvp_reconfirmation,
              id: "",
              questions: [],
              answers: null,
              companion_answers: {},
            }
          : null,
  };
  return {
    invitation,
    emailMissing: Boolean((emailStatusResult.data as { email_missing?: boolean }).email_missing),
  };
}
