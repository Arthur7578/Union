import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { LandingCTAs } from "@/components/LandingCTAs";

export default function Landing() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px",
        textAlign: "center",
      }}
    >
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
          <Spark size={15} color={T.accent} /> The AI wedding negotiator
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
          The AI that doesn&apos;t just help you plan the wedding — it negotiates
          with vendors, closes the deals, and keeps everything calmly under
          control.
        </p>

        <LandingCTAs to="/today" />

        <p style={{ fontSize: 13, color: T.faint, marginTop: 28 }}>
          Here to RSVP? Use the personal invitation link the couple sent you.
        </p>
      </div>
    </main>
  );
}
