"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Button, Card, SectionLabel, Chip, UnionNote } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export default function SearchSetupPage() {
  const router = useRouter();
  const t = useT();
  const [styles, setStyles] = useState<string[]>(t.vendors.stylesDefault);
  const [musts, setMusts] = useState<string[]>(t.vendors.mustsDefault);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <main className="u-main">
      <DemoBanner>{t.vendors.searchDemoNotice}</DemoBanner>
      <BackHeader
        title={t.vendors.searchNewTitle}
        subtitle={t.vendors.searchNewSubtitle}
        fallback="/vendors"
      />

      <div
        className="u-serif"
        style={{
          fontWeight: 600,
          fontSize: 33,
          lineHeight: 1.06,
          color: T.ink,
          padding: "2px 2px 0",
        }}
      >
        {t.vendors.findPhotographer}
      </div>

      <div style={{ marginTop: 16 }}>
        <UnionNote>
          {t.vendors.searchNote.lead}{" "}
          <b style={{ color: T.ink }}>{t.vendors.searchNote.strong}</b>
          {t.vendors.searchNote.trail}
        </UnionNote>
      </div>

      <SectionLabel>{t.vendors.styleYouLove}</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {t.vendors.styles.map((s) => (
          <ChipButton
            key={s}
            label={s}
            active={styles.includes(s)}
            onClick={() => toggle(styles, setStyles, s)}
          />
        ))}
      </div>

      <SectionLabel>{t.vendors.budget}</SectionLabel>
      <Card style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span
            className="u-serif"
            style={{ fontWeight: 600, fontSize: 24, color: T.ink }}
          >
            {t.vendors.budgetRange}
          </span>
          <span
            style={{ fontWeight: 600, fontSize: 12, color: T.greenInk }}
          >
            {t.vendors.flexible}
          </span>
        </div>
        <div
          style={{
            marginTop: 13,
            height: 6,
            borderRadius: 6,
            background: "rgba(67,53,58,.09)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "22%",
              right: "22%",
              top: 0,
              bottom: 0,
              background: T.accent,
              borderRadius: 6,
            }}
          />
          {["22%", "78%"].map((left) => (
            <div
              key={left}
              style={{
                position: "absolute",
                left,
                top: "50%",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                border: `2px solid ${T.accent}`,
                transform: "translate(-50%,-50%)",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: T.faint, marginTop: 12 }}>
          {t.vendors.unionWillBeat}
        </div>
      </Card>

      <SectionLabel>{t.vendors.mustHaves}</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {t.vendors.musts.map((m) => (
          <ChipButton
            key={m}
            label={m}
            active={musts.includes(m)}
            onClick={() => toggle(musts, setMusts, m)}
          />
        ))}
      </div>

      <SectionLabel>{t.vendors.anythingElse}</SectionLabel>
      <textarea defaultValue={t.vendors.anythingElseDefault} />

      <div style={{ marginTop: 20 }}>
        <Button
          style={{ width: "100%", height: 50 }}
          onClick={() => router.push("/vendors/search/active")}
        >
          {t.vendors.startSearch}
        </Button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/vendors" className="u-link">
            {t.vendors.searchMyself}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <Chip active={active} style={{ fontSize: 13.5, padding: "9px 15px" }}>
        {label}
      </Chip>
    </button>
  );
}
