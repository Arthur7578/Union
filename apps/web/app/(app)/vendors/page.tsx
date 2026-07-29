"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { PageHeader, Card, Chip, StatusPill, Avatar, UnionNote } from "@/components/ui";
import { DemoBanner } from "@/components/SampleBadge";
import { ChevronRight } from "@/components/icons";
import { getSample, type VendorStatus } from "@/lib/sample";
import { useT } from "@/lib/i18n/client";

const TONE: Record<string, "green" | "amber" | "accent" | "sand"> = {
  booked: "green",
  contract: "amber",
  approve: "accent",
  comparing: "amber",
  todo: "sand",
};

export default function VendorsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | VendorStatus>("all");
  const t = useT();
  const sample = getSample(t);

  const FILTERS: { key: "all" | VendorStatus; label: string }[] = [
    { key: "all", label: t.vendors.filters.all },
    { key: "booked", label: t.vendors.filters.booked },
    { key: "comparing", label: t.vendors.filters.comparing },
    { key: "todo", label: t.vendors.filters.todo },
  ];

  const vendors =
    filter === "all"
      ? sample.vendors
      : sample.vendors.filter((v) =>
          filter === "comparing"
            ? v.status === "comparing" || v.status === "contract" || v.status === "approve"
            : v.status === filter,
        );

  return (
    <main className="u-main">
      <DemoBanner />
      <PageHeader
        kicker={t.vendors.kicker}
        title={t.vendors.title}
        sub={t.vendors.sub}
        right={
          <Link href="/vendors/new">
            <Chip active>+ {t.common.add}</Chip>
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
          >
            <Chip active={filter === f.key}>{f.label}</Chip>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 11 }}>
        {vendors.map((v) => (
          <Card
            key={v.id}
            onClick={() => router.push(`/vendors/${v.id}`)}
            style={{ display: "flex", alignItems: "center", gap: 13, padding: 15 }}
          >
            <Avatar letter={v.monogram} tint={v.tint} size={44} square />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="u-serif" style={{ fontWeight: 600, fontSize: 19, color: T.ink, lineHeight: 1.1 }}>
                {v.name}
              </div>
              <div style={{ fontSize: 12.5, color: T.faint, marginTop: 1 }}>
                {v.category} · {v.blurb}
              </div>
            </div>
            <StatusPill tone={TONE[v.status]}>{v.statusLabel}</StatusPill>
            <span style={{ marginLeft: 2 }}>
              <ChevronRight />
            </span>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <UnionNote>
          {t.vendors.unionQuiet.before}{" "}
          <b style={{ color: T.ink }}>{t.vendors.unionQuiet.strong}</b>
          {t.vendors.unionQuiet.after}
        </UnionNote>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
        <Link href="/vendors/search" className="u-link">
          {t.vendors.setNewSearch}
        </Link>
      </div>
    </main>
  );
}
