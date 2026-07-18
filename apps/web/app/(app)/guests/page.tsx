"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { fetchGuests, guestStats, type GuestWithRsvp } from "@/lib/data";
import { initial } from "@/lib/format";
import {
  PageHeader,
  Card,
  SectionLabel,
  Button,
  Loading,
  UnionNote,
} from "@/components/ui";
import { SampleBadge } from "@/components/SampleBadge";

const STATUS_DOT: Record<string, string> = {
  attending: T.green,
  declined: "#C7A9A2",
  pending: "#DDB27C",
};

const TOOLS = [
  { href: "/guests/groups", label: "Groups & roles", sub: "Colour-code your list" },
  { href: "/guests/seating", label: "Seating", sub: "Floor plan & ceremony" },
  { href: "/guests/stays", label: "Stays & travel", sub: "Room blocks & shuttles" },
  { href: "/guests/rsvp-form", label: "RSVP form", sub: "Design what you ask" },
];

export default function GuestsPage() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchGuests(wedding.id)
      .then((g) => ok && setGuests(g))
      .catch(() => ok && setGuests([]));
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;
  const stats = guests ? guestStats(guests) : null;

  return (
    <main className="u-main">
      <PageHeader
        kicker={stats ? `${stats.invited} invited` : "Guest list"}
        title="Guests"
        right={
          <Link href="/guests/new">
            <Button style={{ minHeight: 40, fontSize: 14 }}>+ Add</Button>
          </Link>
        }
      />

      {/* Real stat tiles */}
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <StatTile value={stats?.coming} label="Coming" bg={T.greenBg} fg={T.greenDeep} />
        <StatTile value={stats?.declined} label="Can't" bg={T.roseBg} fg={T.rose} />
        <StatTile value={stats?.waiting} label="Waiting" bg={T.amberBg} fg={T.amberInk} />
      </div>

      {/* Sample nudge */}
      {stats && stats.waiting > 0 && (
        <div style={{ marginTop: 14 }}>
          <UnionNote
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SampleBadge />
              </div>
            }
          >
            Want me to gently remind the{" "}
            <b style={{ color: T.ink }}>{stats.waiting} still deciding?</b>
          </UnionNote>
        </div>
      )}

      {/* Planning tools (sample sub-screens) */}
      <SectionLabel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Planning tools</span>
        <SampleBadge />
      </SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card onClick={() => {}} style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                {t.sub}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Real guest list */}
      <SectionLabel>Guest list</SectionLabel>
      {guests === null ? (
        <Loading label="Loading your guests…" />
      ) : guests.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div className="u-serif" style={{ fontSize: 22, color: T.ink }}>
            No guests yet
          </div>
          <div style={{ fontSize: 14, color: T.muted, margin: "6px 0 16px" }}>
            Add the first person you&apos;re inviting to get started.
          </div>
          <Link href="/guests/new">
            <Button>Add a guest</Button>
          </Link>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {guests.map((g) => {
            const status = g.rsvps?.status ?? "pending";
            const group = g.guest_group ? ` · ${g.guest_group}` : "";
            return (
              <Card
                key={g.id}
                onClick={() => router.push(`/guests/${g.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 15px",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: T.accentPink,
                    color: T.accentInk,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: T.serif,
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {initial(g.first_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                    {g.first_name} {g.last_name ?? ""}
                  </div>
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                    Party of {g.party_size ?? 1}
                    {group}
                  </div>
                </div>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: STATUS_DOT[status] ?? T.sand,
                    flexShrink: 0,
                  }}
                />
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatTile({
  value,
  label,
  bg,
  fg,
}: {
  value: number | undefined;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 18,
        background: bg,
        padding: "14px 10px",
        textAlign: "center",
      }}
    >
      <div className="u-serif" style={{ fontWeight: 600, fontSize: 28, color: fg, lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontWeight: 600, fontSize: 11, color: fg, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
