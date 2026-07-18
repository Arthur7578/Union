import React from "react";
import { T } from "@/lib/theme";
import { Spark } from "./icons";

/** Rounded surface card. */
export function Card({
  children,
  style,
  soft,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  soft?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={onClick ? "u-tap" : undefined}
      style={{
        background: soft ? "rgba(255,252,250,.6)" : T.surface,
        border: `1px solid ${soft ? "rgba(67,53,58,.14)" : T.line}`,
        borderStyle: soft ? "dashed" : "solid",
        borderRadius: 20,
        padding: 16,
        boxShadow: soft ? "none" : "0 6px 18px rgba(67,53,58,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Screen title block: uppercase kicker + big serif heading. */
export function PageHeader({
  kicker,
  title,
  sub,
  right,
}: {
  kicker?: string;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        padding: "0 2px",
      }}
    >
      <div>
        {kicker && <div className="u-kicker">{kicker}</div>}
        <h1
          className="u-serif"
          style={{
            fontWeight: 600,
            fontSize: 38,
            lineHeight: 1.02,
            color: T.ink,
            margin: "8px 0 0",
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </h1>
        {sub && (
          <div style={{ fontSize: 14, color: T.muted, marginTop: 7 }}>{sub}</div>
        )}
      </div>
      {right}
    </div>
  );
}

export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="u-section-label"
      style={{ padding: "0 4px 11px", marginTop: 24, ...style }}
    >
      {children}
    </div>
  );
}

/** Small rounded pill (filter chips, tags). */
export function Chip({
  children,
  active,
  tone,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  tone?: { bg: string; fg: string; border?: string };
  style?: React.CSSProperties;
}) {
  const bg = tone?.bg ?? (active ? T.accentSoft : "#fff");
  const fg = tone?.fg ?? (active ? T.ink : T.muted2);
  const border = tone?.border ?? (active ? T.accentBorder : "rgba(67,53,58,.1)");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontWeight: 600,
        fontSize: 12.5,
        padding: "7px 13px",
        borderRadius: 20,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  green: { bg: T.greenBg, fg: T.greenInk },
  amber: { bg: T.amberBg, fg: T.amberInk },
  accent: { bg: T.accentSoft, fg: T.accentInk },
  sand: { bg: T.sandBg, fg: T.sand },
  blue: { bg: T.blueBg, fg: T.blueInk },
};

export function StatusPill({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: keyof typeof STATUS_TONES;
}) {
  const c = STATUS_TONES[tone] ?? STATUS_TONES.green;
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
        fontSize: 11,
        padding: "5px 11px",
        borderRadius: 20,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Rounded avatar with a monogram. */
export function Avatar({
  letter,
  tint = "accent",
  size = 40,
  square,
}: {
  letter: string;
  tint?: "accent" | "green" | "amber" | "sand";
  size?: number;
  square?: boolean;
}) {
  const map = {
    accent: { bg: T.accentPink, fg: T.accentInk },
    green: { bg: T.greenBg, fg: T.greenInk },
    amber: { bg: T.amberBg, fg: T.amberInk },
    sand: { bg: T.sandBg, fg: T.sand },
  } as const;
  const c = map[tint];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: square ? size * 0.3 : "50%",
        background: c.bg,
        color: c.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: T.serif,
        fontWeight: 600,
        fontSize: size * 0.45,
      }}
    >
      {letter}
    </div>
  );
}

/** Slim progress bar. */
export function ProgressBar({
  pct,
  color = T.accent,
  track = "rgba(67,53,58,.08)",
  height = 7,
}: {
  pct: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        background: track,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: color,
          borderRadius: 8,
        }}
      />
    </div>
  );
}

/** The soft rosewood "Union is..." note used throughout the design. */
export function UnionNote({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        background: T.accentSoft,
        padding: "15px 16px",
        display: "flex",
        alignItems: "center",
        gap: 11,
      }}
    >
      <span style={{ flexShrink: 0 }}>
        <Spark size={18} color={T.accent} />
      </span>
      <div
        style={{
          flex: 1,
          fontWeight: 500,
          fontSize: 13.5,
          lineHeight: 1.45,
          color: T.ink2,
        }}
      >
        {children}
      </div>
      {action}
    </div>
  );
}

/** Primary / secondary button. */
export function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled,
  style,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const primary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 46,
        border: primary ? "none" : `1px solid ${T.line3}`,
        borderRadius: 14,
        background: primary ? T.accent : "transparent",
        color: primary ? "#fff" : T.ink,
        fontWeight: 600,
        fontSize: 15,
        padding: "0 18px",
        boxShadow: primary ? "0 6px 16px rgba(67,53,58,.16)" : "none",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Centered spinner-ish loading state. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        padding: "80px 0",
        textAlign: "center",
        color: T.faint,
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}
