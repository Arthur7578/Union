import Link from "next/link";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";

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

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 30,
          }}
        >
          <Link
            href="/sign-in"
            style={{
              minHeight: 50,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 26px",
              borderRadius: 15,
              background: T.accent,
              color: "#fff",
              fontWeight: 600,
              fontSize: 16,
              boxShadow: "0 6px 16px rgba(67,53,58,.16)",
            }}
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            style={{
              minHeight: 50,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 26px",
              borderRadius: 15,
              background: "transparent",
              border: `1px solid ${T.line3}`,
              color: T.ink,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Sign in
          </Link>
        </div>

        <p style={{ fontSize: 13, color: T.faint, marginTop: 28 }}>
          Here to RSVP? Use the personal invitation link the couple sent you.
        </p>
      </div>
    </main>
  );
}
