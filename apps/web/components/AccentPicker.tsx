"use client";

import React from "react";
import { WEDDING_ACCENTS, type WeddingAccent } from "@union/shared";
import { ACCENTS, NEUTRAL_ACCENT, T, alpha } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";

/**
 * The couple's wedding colour: a row of swatches, one per preset plus the
 * neutral default. A radio group, so arrow keys move between swatches.
 */
export function AccentPicker({
  value,
  onChange,
}: {
  value: WeddingAccent | null;
  onChange: (next: WeddingAccent | null) => void;
}) {
  const t = useT();
  const options: Array<{
    key: WeddingAccent | null;
    label: string;
    color: string;
  }> = [
    {
      key: null,
      label: t.account.accentNames.none,
      color: NEUTRAL_ACCENT.base,
    },
    ...WEDDING_ACCENTS.map((key) => ({
      key,
      label: t.account.accentNames[key],
      color: ACCENTS[key].base,
    })),
  ];
  const current = options.find((o) => o.key === value) ?? options[0];
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t.account.accentLabel}
        style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
      >
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <label
              key={o.key ?? "none"}
              title={o.label}
              style={{
                position: "relative",
                width: 40,
                height: 40,
                borderRadius: "50%",
                cursor: "pointer",
                background: o.color,
                boxShadow: selected
                  ? `0 0 0 2px ${T.white}, 0 0 0 4px ${o.color}`
                  : `inset 0 0 0 1px ${alpha(T.ink, 0.12)}`,
              }}
            >
              <input
                type="radio"
                name="wedding-accent"
                checked={selected}
                onChange={() => onChange(o.key)}
                aria-label={o.label}
                className="u-swatch-input"
              />
            </label>
          );
        })}
      </div>
      {/* The chosen colour by name: a phone shows no tooltip. */}
      <div
        aria-hidden
        style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: T.ink }}
      >
        {current.label}
      </div>
    </div>
  );
}
