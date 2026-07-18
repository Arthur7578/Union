import React from "react";
import { T } from "@/lib/theme";
import { SAMPLE_NOTICE } from "@/lib/sample";

/**
 * Small "Sample" pill placed on any card/section that renders mock data, so
 * it's always clear in the UI which content isn't tied to the real account.
 */
export function SampleBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      title={SAMPLE_NOTICE}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: T.blueBg,
        color: T.blueInk,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 20,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: T.blueInk,
        }}
      />
      Sample
    </span>
  );
}

/**
 * A full-width notice for screens that are entirely a preview. Sits at the top
 * of the content column with the shared SAMPLE_NOTICE wording.
 */
export function DemoBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(92,100,138,0.08)",
        border: "1px solid rgba(92,100,138,0.22)",
        color: T.ink2,
        borderRadius: 16,
        padding: "11px 14px",
        marginBottom: 18,
        fontSize: 13,
        lineHeight: 1.45,
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: T.blueBg,
          color: T.blueInk,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        i
      </span>
      <span>{children ?? SAMPLE_NOTICE}</span>
    </div>
  );
}
