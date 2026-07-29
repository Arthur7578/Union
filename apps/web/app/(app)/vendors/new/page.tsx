"use client";

import React, { useState } from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Button, Card, SectionLabel, Chip, UnionNote } from "@/components/ui";
import { Check } from "@/components/icons";
import { useT } from "@/lib/i18n/client";

export default function AddVendorPage() {
  const t = useT();
  const [category, setCategory] = useState(t.vendors.categories[0]);
  const [addToDirectory, setAddToDirectory] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <main className="u-main">
      <DemoBanner />
      <BackHeader
        title={t.vendors.addTitle}
        subtitle={t.vendors.addSubtitle}
        fallback="/vendors"
      />

      <div
        className="u-serif"
        style={{
          fontWeight: 600,
          fontSize: 31,
          lineHeight: 1.08,
          color: T.ink,
          padding: "2px 2px 0",
        }}
      >
        {t.vendors.addHeadline}
      </div>

      <div style={{ marginTop: 15 }}>
        <UnionNote>
          {t.vendors.addNote.before}{" "}
          <b style={{ color: T.ink }}>{t.vendors.addNote.strong}</b>
          {t.vendors.addNote.after}
        </UnionNote>
      </div>

      <SectionLabel>{t.vendors.vendorName}</SectionLabel>
      <input type="text" defaultValue={t.vendors.vendorNameDefault} />

      <SectionLabel>{t.vendors.category}</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {t.vendors.categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
          >
            <Chip active={category === c}>{c}</Chip>
          </button>
        ))}
      </div>

      <SectionLabel>{t.vendors.whereBased}</SectionLabel>
      <input type="text" defaultValue={t.vendors.whereBasedDefault} />

      <SectionLabel>{t.vendors.howToReach}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <input type="text" defaultValue={t.vendors.reachWebsiteDefault} />
        <input type="text" placeholder={t.vendors.reachContactPlaceholder} />
      </div>

      <SectionLabel>{t.vendors.whyYouLove}</SectionLabel>
      <textarea defaultValue={t.vendors.whyYouLoveDefault} />

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
        <span
          style={{
            flex: 1,
            fontWeight: 500,
            fontSize: 13,
            lineHeight: 1.4,
            color: T.ink2,
          }}
        >
          {t.vendors.addToDirectory}
        </span>
      </Card>

      <div style={{ marginTop: 20 }}>
        <Button
          style={{ width: "100%", height: 50 }}
          onClick={() => setSaved(true)}
        >
          {t.vendors.addAndReach}
        </Button>
        {saved && (
          <div
            style={{
              textAlign: "center",
              marginTop: 12,
              fontSize: 13,
              color: T.greenInk,
              fontWeight: 600,
            }}
          >
            {t.vendors.previewOnly}
          </div>
        )}
      </div>
    </main>
  );
}
