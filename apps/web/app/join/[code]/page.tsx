import { getSupabase } from "@/lib/supabase";
import { detectLocale, readLocaleCookie, resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { resolveGuestLocale } from "@/lib/i18n/guestLocale";
import { LocaleProvider } from "@/lib/i18n/client";
import { JoinExperience } from "./JoinExperience";
import { G, alpha } from "@/lib/theme";

// Always fetch fresh — never cache a generic link's guest matching.
export const dynamic = "force-dynamic";

export interface JoinWeddingPreview {
  partner_one: string | null;
  partner_two: string | null;
  event_date: string | null;
  venue_name: string | null;
  guest_join_auth_mode: "contact" | "otp";
  /** The language this couple writes their guest-facing content in. Used as
   *  the floor for the page's language, behind anything the visitor's own
   *  browser tells us. */
  default_locale?: string | null;
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const locale = await resolveLocale();
  const chosenLocale = await readLocaleCookie();
  const detectedLocale = await detectLocale();
  const t = getDictionary(locale);

  let preview: JoinWeddingPreview | null = null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_wedding_by_join_code", {
      p_join_code: code,
    });
    if (!error && data) {
      preview = data as unknown as JoinWeddingPreview;
    }
  } catch (e) {
    console.error("Failed to load wedding by join code:", e);
  }

  if (!preview) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: G.bg,
          fontFamily: "'Instrument Sans', sans-serif",
          padding: "24px",
          color: G.ink,
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            background: "white",
            padding: "40px 32px",
            borderRadius: "24px",
            boxShadow: `0 15px 45px ${alpha(G.ink, 0.05)}`,
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
              color: G.ink,
            }}
          >
            {t.join.invalidTitle}
          </h1>
          <p
            style={{
              color: G.muted,
              fontSize: "16px",
              lineHeight: "1.6",
              marginBottom: 0,
            }}
          >
            {t.join.invalidBody}
          </p>
        </div>
      </main>
    );
  }

  // No guest record exists yet at this point, so the ranking is short: what
  // this visitor picked, then what their browser asks for, then the couple's
  // own default. Same order as the invitation portal, minus the two signals
  // that need a guest to exist.
  const { locale: joinLocale } = resolveGuestLocale({
    deviceChoice: chosenLocale,
    detected: detectedLocale,
    weddingDefault: preview.default_locale,
  });

  return (
    <LocaleProvider initialLocale={joinLocale}>
      <JoinExperience code={code} preview={preview} />
    </LocaleProvider>
  );
}
