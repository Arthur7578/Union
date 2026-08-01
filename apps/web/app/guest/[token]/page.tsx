import { getSupabase } from "@/lib/supabase";
import { resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { GuestPortal } from "./GuestPortal";

// Always fetch fresh invitation data (no static caching of personal links).
export const dynamic = "force-dynamic";

export default async function GuestExperiencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await resolveLocale();
  const t = getDictionary(locale);

  let invitation = null;
  let isDemo = false;

  if (token === "demo") {
    isDemo = true;
    invitation = {
      guest_id: "demo-guest-id",
      guest_first_name: "Arthur",
      guest_last_name: "Pendragon",
      party_size: 2,
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: "2026-09-20",
      venue_name: "Wildflower Barn",
      venue_address: "123 Orchard Rd, Hood River, OR",
      rsvp_status: "pending" as const,
      num_attending: 0,
      dietary_notes: "",
      message: "",
    };
  } else {
    // Attempt to load from Supabase for all other tokens
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("get_invitation", {
        p_token: token,
      });

      if (!error && data && data.length > 0) {
        invitation = data[0];
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
