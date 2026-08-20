import { getSupabase } from "@/lib/supabase";
import { detectLocale, readLocaleCookie, resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { resolveGuestLocale } from "@/lib/i18n/guestLocale";
import { LocaleProvider } from "@/lib/i18n/client";
import Link from "next/link";
import type {
  FormAnswers,
  FormGuestCopy,
  Invitation,
  LocalizedText,
  RsvpQuestion,
  StoredRsvpFields,
} from "@union/shared";
import { GuestPortal } from "./GuestPortal";
import { GuestEmailGate } from "./GuestEmailGate";
import { GuestIdentityGate } from "./GuestIdentityGate";

// Always fetch fresh invitation data (no static caching of personal links).
export const dynamic = "force-dynamic";

export type DBInvitation = Invitation & {
  /** Guest-facing wording overrides for the primary RSVP block, as locale
   *  maps. Null means "use the system default" for the guest's language,
   *  never a blank/empty label; a map missing the guest's locale falls back
   *  through the others before reaching that default. */
  rsvp_form?: {
    title: LocalizedText | null;
    subtitle: LocalizedText | null;
    label_attending: LocalizedText | null;
    label_declined: LocalizedText | null;
    /** Which of the block's optional fields this wedding asks for, as
     *  stored: only the couple's "off" decisions. Absent key means asked,
     *  so `{}` (and a missing field, from a server older than the column)
     *  is the full set of questions. Run it through `resolveRsvpFields`
     *  rather than reading keys directly. */
    fields?: StoredRsvpFields;
  } | null;
  /** The optional late "still coming?" touchpoint. Only shown when
   *  published and within its opens_at/closes_at window. */
  rsvp_reconfirmation?: {
    title: LocalizedText | null;
    subtitle: LocalizedText | null;
    published: boolean;
    opens_at: string | null;
    closes_at: string | null;
  } | null;
  /** Published 'custom' forms for this wedding, with the guest's own answers
   *  (if they've already submitted). Empty until the couple publishes one.
   *  `title` is the organiser's own name for the form — `guest_copy.title` is
   *  the localized heading guests read, and falls back to it. */
  custom_forms?: Array<{
    id: string;
    title: string;
    guest_copy: FormGuestCopy | null;
    questions: RsvpQuestion[];
    published: boolean;
    opens_at: string | null;
    closes_at: string | null;
    /** True when the couple asks this form once per person — the guest
     *  answers for themselves and for each relative they're bringing, the
     *  way the RSVP block already works. False means one answer for the
     *  whole invitation, which is how every form behaved before this. */
    per_person?: boolean;
    answers: FormAnswers | null;
    /** Answers already on record for this guest's own relatives, keyed by
     *  their guest id. Only ever their own household. */
    companion_answers?: Record<string, FormAnswers> | null;
  }>;
};

export default async function GuestExperiencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await resolveLocale();
  const chosenLocale = await readLocaleCookie();
  const detectedLocale = await detectLocale();
  const t = getDictionary(locale);

  let invitation: DBInvitation | null = null;
  let isDemo = false;
  let emailMissing = false;

  if (token === "demo") {
    isDemo = true;
    invitation = {
      wedding: {
        partner_one: "Maya",
        partner_two: "Daniel",
        event_date: "2026-09-20",
        venue_name: "Wildflower Barn",
        address_visibility: "full",
        address: {
          line: "123 Orchard Rd",
          postal_code: "97031",
          city: "Hood River",
          area: null,
          country: "United States",
        },
      },
      guest: {
        id: "demo-guest-id",
        first_name: "Arthur",
        last_name: "Pendragon",
        age_years: 30,
        rsvp_status: "pending",
        dietary_notes: "",
        message: "",
        locale: null,
      },
      companions: [
        {
          id: "demo-companion-1",
          first_name: "Guinevere",
          last_name: "Pendragon",
          age_years: 28,
          relationship: "partner_of",
          rsvp_status: "pending",
          dietary_notes: "",
        }
      ],
      permissions: {
        can_add_partner: false,
        can_add_kids: false,
        kids_remaining: 0,
      },
      self_merge_candidates: [],
    };
  } else {
    // Attempt to load from Supabase for all other tokens
    try {
      const supabase = getSupabase();
      const [invitationResult, emailStatusResult] = await Promise.all([
        supabase.rpc("get_invitation", { p_token: token }),
        supabase.rpc("get_guest_email_status", { p_token: token }),
      ]);

      if (
        !invitationResult.error &&
        invitationResult.data &&
        !emailStatusResult.error &&
        emailStatusResult.data
      ) {
        // Since get_invitation returns a JSONB object, cast it directly to DBInvitation
        invitation = invitationResult.data as unknown as DBInvitation;
        emailMissing = Boolean(
          (emailStatusResult.data as { email_missing?: boolean }).email_missing,
        );
      }
    } catch (e) {
      console.error("Failed to load invitation from Supabase:", e);
    }
  }

  // If a real token was used but no invitation was found, display a beautifully styled error page
  if (!invitation) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f1ea",
          fontFamily: "'Instrument Sans', sans-serif",
          padding: "24px",
          color: "#2b2724",
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            background: "white",
            padding: "40px 32px",
            borderRadius: "24px",
            boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>✉️</div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "32px",
              fontWeight: "600",
              marginBottom: "12px",
              color: "#2b2724",
            }}
          >
            {t.rsvp.invalidTitle}
          </h1>
          <p
            style={{
              color: "#8a817c",
              fontSize: "16px",
              lineHeight: "1.6",
              marginBottom: "32px",
            }}
          >
            {t.rsvp.invalidBody}
          </p>
          <Link
            href="/guest/demo"
            style={{
              display: "inline-block",
              width: "100%",
              padding: "16px",
              background: "#43353a",
              color: "white",
              borderRadius: "14px",
              fontWeight: "600",
              textDecoration: "none",
              fontSize: "15px",
              transition: "opacity 0.2s",
            }}
          >
            {locale === "fr" ? "Voir la version démo" : "View demo experience"}
          </Link>
        </div>
      </main>
    );
  }

  const guestName = [invitation.guest.first_name, invitation.guest.last_name]
    .filter(Boolean)
    .join(" ");

  // Which language to open the invitation in. The ranking lives in
  // resolveGuestLocale: anything the guest said themselves, then the couple's
  // override for them, then their browser, and only then the language the
  // couple writes their content in. The wedding default is the floor — a
  // French-speaking browser is a fact about this reader and outranks it.
  const { locale: initialLocale } = resolveGuestLocale({
    deviceChoice: chosenLocale,
    guestChoice: invitation.guest.chosen_locale,
    organiserOverride: invitation.guest.locale,
    detected: detectedLocale,
    weddingDefault: invitation.wedding.default_locale,
  });

  return (
    <LocaleProvider initialLocale={initialLocale}>
      <GuestIdentityGate
        guestId={invitation.guest.id}
        guestName={guestName}
      >
        <GuestEmailGate
          token={token}
          guestId={invitation.guest.id}
          guestName={guestName}
          emailMissing={emailMissing}
        >
          <GuestPortal
            token={token}
            invitation={invitation}
            isDemo={isDemo}
          />
        </GuestEmailGate>
      </GuestIdentityGate>
    </LocaleProvider>
  );
}
