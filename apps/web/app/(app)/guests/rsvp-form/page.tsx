"use client";

import React from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Card, Chip, Button } from "@/components/ui";

type Question = {
  kind: string;
  kindTone: { bg: string; fg: string };
  required: boolean;
  title: string;
  options?: { label: string; primary?: boolean }[];
  freeText?: boolean;
};

const QUESTIONS: Question[] = [
  {
    kind: "Single choice",
    kindTone: { bg: "#EEE7F0", fg: "#7A6690" },
    required: true,
    title: "Will you celebrate with us?",
    options: [{ label: "Joyfully accepts", primary: true }, { label: "Regretfully declines" }],
  },
  {
    kind: "Multiple choice",
    kindTone: { bg: "#E7EFE6", fg: "#5E7A63" },
    required: false,
    title: "Which events will you join?",
    options: [{ label: "Welcome dinner" }, { label: "Ceremony" }, { label: "Reception" }, { label: "Sunday brunch" }],
  },
  {
    kind: "Single choice",
    kindTone: { bg: "#EEE7F0", fg: "#7A6690" },
    required: true,
    title: "Meal preference",
    options: [{ label: "Chicken" }, { label: "Fish" }, { label: "Vegetarian" }, { label: "Kids meal" }],
  },
  {
    kind: "Open comment",
    kindTone: { bg: "#FBEEE2", fg: "#B07C48" },
    required: false,
    title: "Any dietary needs or allergies?",
    freeText: true,
  },
];

export default function RsvpFormPage() {
  return (
    <main className="u-main">
      <DemoBanner>
        Sample data — a preview of the RSVP form builder. The live guest RSVP flow
        runs on your invitation links.
      </DemoBanner>
      <BackHeader title="Your RSVP form" subtitle="Draft · not sent yet" fallback="/guests" />

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {QUESTIONS.map((q) => (
          <Card key={q.title} style={{ padding: "15px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ background: q.kindTone.bg, color: q.kindTone.fg, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.04em", padding: "4px 10px", borderRadius: 20 }}>
                {q.kind}
              </span>
              <span style={{ fontWeight: q.required ? 600 : 500, fontSize: 11, color: q.required ? T.accentInk : T.label }}>
                {q.required ? "Required" : "Optional"}
              </span>
            </div>
            <div className="u-serif" style={{ fontWeight: 600, fontSize: 18, color: T.ink, marginTop: 11, lineHeight: 1.2 }}>
              {q.title}
            </div>
            {q.options && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                {q.options.map((o) => (
                  <Chip key={o.label} active={o.primary}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            )}
            {q.freeText && (
              <div
                style={{
                  marginTop: 11,
                  borderRadius: 12,
                  background: "#F7F1EC",
                  border: "1px solid rgba(67,53,58,.08)",
                  padding: "11px 13px",
                  fontSize: 13,
                  color: T.label,
                  fontStyle: "italic",
                }}
              >
                Guests type a short answer…
              </div>
            )}
          </Card>
        ))}

        <Card soft style={{ padding: "14px 16px" }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: T.accentInk }}>+ Add a question</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
            {["Single choice", "Multiple choice", "Short text", "Comment"].map((t) => (
              <Chip key={t} style={{ fontSize: 11.5, padding: "6px 11px" }}>
                {t}
              </Chip>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <Button style={{ width: "100%", height: 50 }}>Save &amp; send with invitations</Button>
      </div>
    </main>
  );
}
