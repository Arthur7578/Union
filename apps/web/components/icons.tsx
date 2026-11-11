import React from "react";
import { T, alpha } from "@/lib/theme";

type IconProps = { size?: number; color?: string; stroke?: string };

/** The Union four-point spark (brand mark). Filled. */
export function Spark({ size = 18, color = T.accent }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"
        fill={color}
      />
    </svg>
  );
}

export function TodayIcon({ size = 24, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11l8-7 8 7M6.2 9.4V20h11.6V9.4"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VendorsIcon({ size = 24, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="6" rx="2" stroke={stroke} strokeWidth="1.8" />
      <rect x="3.5" y="14" width="17" height="6" rx="2" stroke={stroke} strokeWidth="1.8" />
    </svg>
  );
}

export function GuestsIcon({ size = 24, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.1" stroke={stroke} strokeWidth="1.8" />
      <path
        d="M3.4 19.5c0-3 2.5-5.2 5.6-5.2s5.6 2.2 5.6 5.2"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.2 6.4a2.9 2.9 0 0 1 .2 5.6M17.4 14.6c2.2.4 3.9 2.1 3.9 4.9"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlanIcon({ size = 24, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" stroke={stroke} strokeWidth="1.8" />
      <path
        d="M4 10h16M9 3.5v4M15 3.5v4M8 14h3M8 17h6"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronLeft({ size = 16, stroke = T.muted }: IconProps) {
  return (
    <svg width={(size * 10) / 16} height={size} viewBox="0 0 10 16" aria-hidden>
      <path
        d="M8 1L2 8l6 7"
        stroke={stroke}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRight({ size = 14, stroke = alpha(T.ink, 0.3) }: IconProps) {
  return (
    <svg width={(size * 8) / 14} height={size} viewBox="0 0 8 14" aria-hidden>
      <path
        d="M1 1l6 6-6 6"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Check({ size = 13, stroke = T.greenInk }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path
        d="M2 7.5l3.2 3.2L12 3.5"
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpArrow({ size = 18, stroke = T.white }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 19V6M6 11l6-6 6 6"
        stroke={stroke}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 18, stroke = T.muted2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke={stroke} strokeWidth="2" fill="none" />
      <path d="M16 16l4.5 4.5" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 20, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="3" stroke={stroke} strokeWidth="2" fill="none" />
      <path d="M4 7.5l8 6 8-6" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14, stroke = T.white }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path d="M7 1.5v11M1.5 7h11" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LinkIcon({ size = 20, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TableIcon({ size = 20, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4.5" stroke={stroke} strokeWidth="2" fill="none" />
      <circle cx="12" cy="3.5" r="1.5" fill={stroke} />
      <circle cx="12" cy="20.5" r="1.5" fill={stroke} />
      <circle cx="3.5" cy="12" r="1.5" fill={stroke} />
      <circle cx="20.5" cy="12" r="1.5" fill={stroke} />
    </svg>
  );
}

export function QuestionIcon({ size = 20, stroke = T.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="2" fill="none" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill={stroke} />
    </svg>
  );
}
