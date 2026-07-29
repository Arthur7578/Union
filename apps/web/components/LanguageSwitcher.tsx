"use client";

import React from "react";
import { useLocale } from "@/lib/i18n/client";
import { T } from "@/lib/theme";
import type { Locale } from "@/lib/i18n";

/** Segmented switch between the available locales. Renders inline so it fits
 *  the sidebar, settings screen, and the sign-in / RSVP page footers. */
export function LanguageSwitcher({
  compact,
  style,
}: {
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const { locale, setLocale, locales, t } = useLocale();
  const labels: Record<Locale, string> = {
    en: t.lang.en,
    fr: t.lang.fr,
  };
  return (
    <div
      role="group"
      aria-label={t.lang.switchTo}
      style={{
        display: "inline-flex",
        gap: 0,
        padding: 3,
        borderRadius: 999,
        background: "rgba(67,53,58,.06)",
        border: `1px solid ${T.line}`,
        ...style,
      }}
    >
      {locales.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            style={{
              minHeight: compact ? 28 : 34,
              padding: compact ? "0 10px" : "0 14px",
              border: "none",
              borderRadius: 999,
              background: active ? T.accent : "transparent",
              color: active ? "#fff" : T.muted2,
              fontWeight: 600,
              fontSize: compact ? 12 : 13,
              cursor: "pointer",
              transition: "background .15s ease, color .15s ease",
            }}
          >
            {compact ? code.toUpperCase() : labels[code]}
          </button>
        );
      })}
    </div>
  );
}
