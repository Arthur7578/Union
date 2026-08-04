import { getSupabase } from "@/lib/supabase";
import { resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import type { FormAnswers, Invitation, RsvpQuestion } from "@union/shared";
import { GuestPortal } from "./GuestPortal";

// Always fetch fresh invitation data (no static caching of personal links).
export const dynamic = "force-dynamic";

export type DBInvitation = Invitation & {
  /** Guest-facing wording overrides for the primary RSVP block — null keys
   *  mean "use the system default", never a blank/empty label. */
  rsvp_form?: {
    title: string | null;
    subtitle: string | null;
    label_attending: string | null;
    label_declined: string | null;
  } | null;
  /** The optional late "still coming?" touchpoint. Only shown when
   *  published and within its opens_at/closes_at window. */
  rsvp_reconfirmation?: {
    title: string | null;
    subtitle: string | null;
    published: boolean;
    opens_at: string | null;
    closes_at: string | null;
  } | null;
  /** Published 'custom' forms for this wedding, with the guest's own answers
   *  (if they've already submitted). Empty until the couple publishes one. */
  custom_forms?: Array<{
    id: string;
    title: string;
    questions: RsvpQuestion[];
    published: boolean;
    opens_at: string | null;
    closes_at: string | null;
    answers: FormAnswers | null;
  }>;
};

export default async function GuestExperiencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await resolveLocale();
  const t = getDictionary(locale);

  let invitation: DBInvitation | null = null;
  let isDemo = false;

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
      const { data, error } = await supabase.rpc("get_invitation", {
        p_token: token,
      });

      if (!error && data) {
        // Since get_invitation returns a JSONB object, cast it directly to DBInvitation
        invitation = data as unknown as DBInvitation;
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
          <a
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
          </a>
        </div>
      </main>
    );
  }

  return (
    <GuestPortal
      token={token}
      invitation={invitation}
      isDemo={isDemo}
    />
  );
}
