import { getSupabase } from "@/lib/supabase";
import { resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { JoinExperience } from "./JoinExperience";

// Always fetch fresh — never cache a generic link's guest matching.
export const dynamic = "force-dynamic";

export interface JoinWeddingPreview {
  partner_one: string | null;
  partner_two: string | null;
  event_date: string | null;
  venue_name: string | null;
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const locale = await resolveLocale();
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
            {t.join.invalidTitle}
          </h1>
          <p
            style={{
              color: "#8a817c",
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

  return <JoinExperience code={code} preview={preview} />;
}
