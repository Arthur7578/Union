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

  // UUID regex pattern to validate token
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(token)) {
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

  // Fallback to sample/demo mode if invitation not found or token is demo-like
  if (!invitation) {
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
  }

  return (
    <GuestPortal
      token={token}
      invitation={invitation}
      isDemo={isDemo}
    />
  );
}
