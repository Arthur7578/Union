"use client";

import React from "react";
import { useParams } from "next/navigation";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Button } from "@/components/ui";
import { Spark, UpArrow } from "@/components/icons";
import { SAMPLE_VENDORS, SAMPLE_NEGOTIATION } from "@/lib/sample";

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const vendor =
    SAMPLE_VENDORS.find((v) => v.id === params?.id) ?? SAMPLE_VENDORS[2];

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader
        title={vendor.name}
        subtitle={`${vendor.category} · Union is negotiating`}
        fallback="/vendors"
        right={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: T.amberBg,
              borderRadius: 20,
              padding: "5px 10px",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber }} />
            <span style={{ fontWeight: 600, fontSize: 11, color: T.amberInk }}>Live</span>
          </span>
        }
      />

      <div style={{ textAlign: "center", margin: "2px 0 10px" }}>
        <span style={{ fontWeight: 500, fontSize: 11.5, color: T.label }}>
          Union opened on your behalf · Mon 9:12 AM
        </span>
      </div>

      {/* Chat thread */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {SAMPLE_NEGOTIATION.map((turn, i) => {
          const mine = turn.from === "union";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: mine ? "flex-end" : "flex-start",
                gap: 5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: mine ? "0 4px 0 0" : "0 0 0 4px",
                }}
              >
                {mine ? (
                  <Spark size={12} color={T.accent} />
                ) : (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: T.accentPink,
                      color: T.accentInk,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.serif,
                      fontWeight: 600,
                      fontSize: 10,
                    }}
                  >
                    {turn.who.charAt(0)}
                  </span>
                )}
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: mine ? T.accent : T.faint,
                  }}
                >
                  {turn.who}
                </span>
              </div>
              <div
                style={{
                  maxWidth: "82%",
                  background: mine ? T.accentSoft : T.surface,
                  border: `1px solid ${mine ? T.accentBorder : "rgba(67,53,58,.09)"}`,
                  borderRadius: mine ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                  padding: "12px 15px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: T.ink,
                }}
                dangerouslySetInnerHTML={{ __html: bold(turn.text) }}
              />
            </div>
          );
        })}
      </div>

      {/* Agreed summary */}
      <div
        style={{
          marginTop: 22,
          borderRadius: 22,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: 18,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.greenInk,
            }}
          >
            Agreed
          </span>
        </div>
        <div
          className="u-serif"
          style={{ fontWeight: 600, fontSize: 30, lineHeight: 1, color: T.ink, marginTop: 10 }}
        >
          $3,300{" "}
          <span style={{ fontSize: 16, color: T.faint, fontWeight: 500, textDecoration: "line-through" }}>
            $3,840
          </span>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: T.ink2, marginTop: 8 }}>
          Union held your budget and found{" "}
          <b style={{ color: T.greenInk }}>$540 in savings</b>. Approve to lock it
          in and release the deposit.
        </div>
        <Button style={{ width: "100%", marginTop: 14 }}>Approve &amp; send deposit</Button>
      </div>

      {/* Composer (sample) */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
        <div
          style={{
            flex: 1,
            height: 46,
            borderRadius: 23,
            background: "#fff",
            border: `1px solid ${T.line3}`,
            display: "flex",
            alignItems: "center",
            padding: "0 17px",
            fontSize: 14,
            color: T.label,
          }}
        >
          Ask Union to counter or adjust…
        </div>
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: T.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <UpArrow />
        </span>
      </div>
    </main>
  );
}

/** Minimal **bold** rendering for the sample chat copy. */
function bold(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
