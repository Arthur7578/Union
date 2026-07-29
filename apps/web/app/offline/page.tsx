import type { Metadata } from "next";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { resolveLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "You're offline",
};

export default async function Offline() {
  const locale = await resolveLocale();
  const t = getDictionary(locale);
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
          {t.offline.title}
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
          {t.offline.body}
        </p>
      </div>
    </main>
  );
}
