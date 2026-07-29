"use client";

import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { LandingCTAs } from "@/components/LandingCTAs";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";

export default function Landing() {
  const t = useT();
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(56px, calc(24px + env(safe-area-inset-top))) max(24px, env(safe-area-inset-right)) max(56px, calc(24px + env(safe-area-inset-bottom))) max(24px, env(safe-area-inset-left))",
        textAlign: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "max(20px, env(safe-area-inset-top))",
          right: "max(20px, env(safe-area-inset-right))",
        }}
      >
        <LanguageSwitcher compact />
      </div>

      <div style={{ maxWidth: 560 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: T.label,
          }}
        >
          <Spark size={15} color={T.accent} /> {t.landing.kicker}
        </div>

        <h1
          className="u-serif"
          style={{
            fontWeight: 600,
            fontSize: 76,
            lineHeight: 1,
            color: T.ink,
            margin: "14px 0 0",
            letterSpacing: "0.01em",
          }}
        >
          Union
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.5,
            color: T.muted,
            margin: "18px auto 0",
            maxWidth: 460,
          }}
        >
          {t.landing.tagline}
        </p>

        <LandingCTAs to="/today" />

        <p style={{ fontSize: 13, color: T.faint, marginTop: 28 }}>
          {t.landing.rsvpHint}
        </p>
      </div>
    </main>
  );
}
