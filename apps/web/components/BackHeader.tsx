"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { ChevronLeft } from "./icons";

/** Back chevron + title/subtitle row used on detail & form screens. */
export function BackHeader({
  title,
  subtitle,
  fallback = "/today",
  right,
}: {
  title: string;
  subtitle?: string;
  fallback?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
      }}
    >
      <button
        onClick={back}
        aria-label="Back"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: `1px solid ${T.line3}`,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ChevronLeft />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="u-serif"
          style={{ fontWeight: 600, fontSize: 21, color: T.ink, lineHeight: 1.1 }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: T.faint }}>{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  );
}
