import type { Metadata } from "next";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";

export const metadata: Metadata = {
  title: "You're offline",
};

export default function Offline() {
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
          "max(56px, calc(24px + env(safe-area-inset-top))) 24px max(56px, calc(24px + env(safe-area-inset-bottom)))",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <Spark size={26} color={T.accent} />
        <h1
          className="u-serif"
          style={{
            fontWeight: 600,
            fontSize: 40,
            lineHeight: 1.05,
            color: T.ink,
            margin: "16px 0 0",
          }}
        >
          You&apos;re offline
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.5,
            color: T.muted,
            margin: "14px auto 0",
            maxWidth: 340,
          }}
        >
          Union needs a connection for this screen. Check your network — anything
          you&apos;ve already opened is still available.
        </p>
      </div>
    </main>
  );
}
