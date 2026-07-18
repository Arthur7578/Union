"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { DemoBanner } from "@/components/SampleBadge";
import { Button, Card, SectionLabel, Chip, UnionNote } from "@/components/ui";

const STYLES = ["Documentary", "Golden-hour", "Editorial", "Film / analog", "Light & airy", "Moody"];
const MUSTS = ["Full-day coverage", "Second shooter", "Engagement shoot", "Fine-art prints"];

export default function SearchSetupPage() {
  const router = useRouter();
  const [styles, setStyles] = useState<string[]>(["Documentary", "Golden-hour"]);
  const [musts, setMusts] = useState<string[]>(["Full-day coverage", "Second shooter"]);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <main className="u-main">
      <DemoBanner>
        Sample data — this is a preview of how you&apos;d brief Union on a new
        search. It isn&apos;t connected to your account yet.
      </DemoBanner>
      <BackHeader title="New search" subtitle="Photographer" fallback="/vendors" />

      <div
        className="u-serif"
        style={{ fontWeight: 600, fontSize: 33, lineHeight: 1.06, color: T.ink, padding: "2px 2px 0" }}
      >
        Let&apos;s find your photographer.
      </div>

      <div style={{ marginTop: 16 }}>
        <UnionNote>
          I&apos;ll handle the searching, outreach and comparing.{" "}
          <b style={{ color: T.ink }}>
            I never book, pay, or commit to anything without your yes
          </b>{" "}
          — you&apos;ll approve every shortlist and quote.
        </UnionNote>
      </div>

      <SectionLabel>Style you love</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {STYLES.map((s) => (
          <ChipButton key={s} label={s} active={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)} />
        ))}
      </div>

      <SectionLabel>Budget</SectionLabel>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="u-serif" style={{ fontWeight: 600, fontSize: 24, color: T.ink }}>
            $4,000 – $5,000
          </span>
          <span style={{ fontWeight: 600, fontSize: 12, color: T.greenInk }}>flexible</span>
        </div>
        <div style={{ marginTop: 13, height: 6, borderRadius: 6, background: "rgba(67,53,58,.09)", position: "relative" }}>
          <div style={{ position: "absolute", left: "22%", right: "22%", top: 0, bottom: 0, background: T.accent, borderRadius: 6 }} />
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
          Union will try to beat the top of this range.
        </div>
      </Card>

      <SectionLabel>Must-haves</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {MUSTS.map((m) => (
          <ChipButton key={m} label={m} active={musts.includes(m)} onClick={() => toggle(musts, setMusts, m)} />
        ))}
      </div>

      <SectionLabel>Anything else?</SectionLabel>
      <textarea defaultValue="Warm and candid — loves catching real moments over posing. Bonus if they know the Wildflower Barn." />

      <div style={{ marginTop: 20 }}>
        <Button style={{ width: "100%", height: 50 }} onClick={() => router.push("/vendors/search/active")}>
          Start the search
        </Button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/vendors" className="u-link">
            I&apos;d rather search myself
          </Link>
        </div>
      </div>
    </main>
  );
}

function ChipButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
      <Chip active={active} style={{ fontSize: 13.5, padding: "9px 15px" }}>
        {label}
      </Chip>
    </button>
  );
}
