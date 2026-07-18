"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { PageHeader, Card, Chip, StatusPill, Avatar, UnionNote } from "@/components/ui";
import { DemoBanner } from "@/components/SampleBadge";
import { ChevronRight } from "@/components/icons";
import { SAMPLE_VENDORS, type VendorStatus } from "@/lib/sample";

const FILTERS: { key: "all" | VendorStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booked", label: "Booked" },
  { key: "comparing", label: "In motion" },
  { key: "todo", label: "To do" },
];

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

  const vendors =
    filter === "all"
      ? SAMPLE_VENDORS
      : SAMPLE_VENDORS.filter((v) =>
          filter === "comparing"
            ? v.status === "comparing" || v.status === "contract" || v.status === "approve"
            : v.status === filter,
        );

  return (
    <main className="u-main">
      <DemoBanner />
      <PageHeader
        kicker="12 vendors"
        title="Vendors"
        sub="2 booked · Union working 3 · 1 waiting on you"
        right={
          <Link href="/vendors/new">
            <Chip active>+ Add</Chip>
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
          Union is quietly working on <b style={{ color: T.ink }}>3 of these</b>{" "}
          right now. You&apos;ll only hear from it when a decision is yours.
        </UnionNote>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
        <Link href="/vendors/search" className="u-link">
          Set a new search in motion →
        </Link>
      </div>
    </main>
  );
}
