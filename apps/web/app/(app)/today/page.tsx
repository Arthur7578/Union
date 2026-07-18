"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { fetchGuests, guestStats, type GuestWithRsvp } from "@/lib/data";
import {
  daysUntil,
  firstName,
  formatLongDate,
  todayKicker,
} from "@/lib/format";
import { Card, SectionLabel, Button, StatusPill } from "@/components/ui";
import { SampleBadge } from "@/components/SampleBadge";
import { Spark, Check } from "@/components/icons";
import { SAMPLE_HANDLING } from "@/lib/sample";

export default function TodayPage() {
  const { wedding } = useWedding();
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
  const days = daysUntil(wedding.event_date);
  const name = firstName(wedding.partner_one);
  const venueLine = [wedding.venue_name, formatLongDate(wedding.event_date)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="u-main">
      {/* Greeting */}
      <div style={{ padding: "0 2px" }}>
        <div className="u-kicker">{todayKicker()}</div>
        <h1
          className="u-serif"
          style={{
            fontWeight: 600,
            fontSize: 40,
            lineHeight: 1.02,
            color: T.ink,
            margin: "9px 0 0",
          }}
        >
          Good morning,
          <br />
          {name}.
        </h1>
      </div>

      {/* Countdown */}
      <div
        style={{
          marginTop: 20,
          borderRadius: 26,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: "22px 22px 20px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: T.greenInk,
            }}
          >
            On track
          </span>
        </div>
        <div
          className="u-serif"
          style={{
            fontWeight: 600,
            fontSize: 56,
            lineHeight: 1,
            color: T.ink,
            marginTop: 14,
          }}
        >
          {days !== null && days >= 0 ? days : "—"}{" "}
          <span style={{ fontSize: 22, color: T.faint, fontWeight: 500 }}>
            {days !== null && days >= 0 ? "days to go" : "set your date"}
          </span>
        </div>
        {venueLine && (
          <div style={{ fontSize: 14, color: T.muted, marginTop: 9 }}>
            {venueLine}
          </div>
        )}
        <div style={{ height: 1, background: "rgba(67,53,58,.09)", margin: "16px 0 14px" }} />
        <div style={{ fontSize: 14, lineHeight: 1.55, color: T.ink2 }}>
          Union is handling <b style={{ color: T.ink }}>three things</b> for you
          right now. Nothing needs to worry you today — except one happy
          decision.
        </div>
      </div>

      {/* Needs you today (sample task) */}
      <SectionLabel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Needs you today</span>
        <SampleBadge />
      </SectionLabel>
      <Card style={{ padding: 18, boxShadow: "0 10px 26px rgba(67,53,58,.06)" }}>
        <div
          className="u-serif"
          style={{ fontWeight: 600, fontSize: 23, lineHeight: 1.15, color: T.ink }}
        >
          Approve the florist&apos;s final quote
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: T.muted, marginTop: 8 }}>
          Union negotiated The Wild Stem down to <b style={{ color: T.ink }}>$3,300</b>{" "}
          — <span style={{ color: T.greenInk, fontWeight: 600 }}>$540 under</span>{" "}
          your florals budget, same garden-style arrangements you loved.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Link href="/vendors/the-wild-stem" style={{ flex: 1.4 }}>
            <Button style={{ width: "100%" }}>Approve</Button>
          </Link>
          <Link href="/vendors/the-wild-stem" style={{ flex: 1 }}>
            <Button variant="secondary" style={{ width: "100%" }}>
              Review
            </Button>
          </Link>
        </div>
      </Card>

      {/* Live guest snapshot (real data) */}
      <SectionLabel>Your guests</SectionLabel>
      <Link href="/guests">
        <Card onClick={() => {}} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", textAlign: "center" }}>
            <SnapStat
              value={stats ? stats.coming : "—"}
              label="Coming"
              color={T.greenDeep}
            />
            <Divider />
            <SnapStat
              value={stats ? stats.waiting : "—"}
              label="Waiting"
              color={T.amberInk}
            />
            <Divider />
            <SnapStat
              value={stats ? stats.declined : "—"}
              label="Can't"
              color={T.rose}
            />
          </div>
          <div
            style={{
              borderTop: `1px solid ${T.line}`,
              padding: "12px 16px",
              fontSize: 13,
              color: T.muted,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              {stats ? `${stats.parties} parties · ${stats.invited} invited` : "Loading…"}
            </span>
            <span style={{ color: T.accentInk, fontWeight: 600 }}>Open guests →</span>
          </div>
        </Card>
      </Link>

      {/* Union is handling (sample) */}
      <SectionLabel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Union is handling</span>
        <SampleBadge />
      </SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {SAMPLE_HANDLING.map((item, i) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "15px 16px",
              borderBottom:
                i < SAMPLE_HANDLING.length - 1 ? `1px solid ${T.line}` : "none",
            }}
          >
            <PulseDot delay={i * 0.6} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14.5, color: T.ink }}>
                {item.title}
              </div>
              <div style={{ fontWeight: 400, fontSize: 12.5, color: T.faint, marginTop: 2 }}>
                {item.sub}
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: 11, color: T.amberInk }}>
              {item.tag}
            </span>
          </div>
        ))}
      </Card>

      {/* Just closed (sample) */}
      <SectionLabel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Just closed</span>
        <SampleBadge />
      </SectionLabel>
      <Card style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: T.greenBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Check />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14.5, color: T.ink }}>
            Venue deposit paid — it&apos;s yours
          </div>
          <div style={{ fontSize: 12.5, color: T.faint, marginTop: 2 }}>
            Wildflower Barn · approved by {name} · 2 days ago
          </div>
        </div>
      </Card>
    </main>
  );
}

function SnapStat({
  value,
  label,
  color,
}: {
  value: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div style={{ flex: 1, padding: "16px 8px" }}>
      <div className="u-serif" style={{ fontWeight: 600, fontSize: 30, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontWeight: 600, fontSize: 11, color: T.faint, marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, background: T.line, margin: "12px 0" }} />;
}

function PulseDot({ delay }: { delay: number }) {
  return (
    <span style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: T.amber,
          animation: `unionpulse 2.4s ease-in-out infinite ${delay}s`,
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: T.amber,
        }}
      />
    </span>
  );
}
