"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Button, Card, SectionLabel, Chip, UnionNote } from "@/components/ui";
import { Check } from "@/components/icons";

const CATEGORIES = ["Photography", "Video", "Florals", "Music", "Other"];

export default function AddVendorPage() {
  const [category, setCategory] = useState("Photography");
  const [addToDirectory, setAddToDirectory] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader title="Add a vendor" subtitle="New to Union" fallback="/vendors" />

      <div
        className="u-serif"
        style={{ fontWeight: 600, fontSize: 31, lineHeight: 1.08, color: T.ink, padding: "2px 2px 0" }}
      >
        Add a vendor we don&apos;t know yet.
      </div>

      <div style={{ marginTop: 15 }}>
        <UnionNote>
          Once you add them, they join the <b style={{ color: T.ink }}>Union directory</b>.
          I can start a conversation on your behalf — and future couples can find
          them too.
        </UnionNote>
      </div>

      <SectionLabel>Vendor name</SectionLabel>
      <input type="text" defaultValue="Fernwood Film Co." />

      <SectionLabel>Category</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
          >
            <Chip active={category === c}>{c}</Chip>
          </button>
        ))}
      </div>

      <SectionLabel>Where they&apos;re based</SectionLabel>
      <input type="text" defaultValue="Hudson Valley, NY" />

      <SectionLabel>How to reach them</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <input type="text" defaultValue="fernwoodfilm.co" />
        <input type="text" placeholder="Email or phone (optional)" />
      </div>

      <SectionLabel>Why you love them</SectionLabel>
      <textarea defaultValue="Shot my sister's wedding on film — unreal with natural light. Not sure they're on any platform yet." />

      <Card
        onClick={() => setAddToDirectory((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: addToDirectory ? T.accent : "#fff",
            border: addToDirectory ? "none" : `1px solid ${T.line3}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {addToDirectory && <Check stroke="#fff" />}
        </span>
        <span style={{ flex: 1, fontWeight: 500, fontSize: 13, lineHeight: 1.4, color: T.ink2 }}>
          Add to the Union directory so other couples can discover them.
        </span>
      </Card>

      <div style={{ marginTop: 20 }}>
        <Button style={{ width: "100%", height: 50 }} onClick={() => setSaved(true)}>
          Add &amp; let Union reach out
        </Button>
        {saved && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: T.greenInk, fontWeight: 600 }}>
            Preview only — nothing was saved to your account.
          </div>
        )}
      </div>
    </main>
  );
}
