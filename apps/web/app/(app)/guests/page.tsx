"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import {
  fetchGuests,
  guestStats,
  markRemindersSent,
  type GuestWithRsvp,
} from "@/lib/data";
import { initial } from "@/lib/format";
import {
  PageHeader,
  Card,
  SectionLabel,
  Button,
  Loading,
  UnionNote,
  Chip,
} from "@/components/ui";

type Filter = "all" | "coming" | "waiting" | "declined";

const STATUS_DOT: Record<string, string> = {
  attending: T.green,
  declined: "#C7A9A2",
  pending: "#DDB27C",
};

const TOOLS = [
  { href: "/guests/groups", label: "Groups & roles", sub: "Colour-code your list" },
  { href: "/guests/seating", label: "Seating", sub: "Floor plan & ceremony" },
  { href: "/guests/stays", label: "Stays & travel", sub: "Room blocks" },
  { href: "/guests/rsvp-form", label: "RSVP form", sub: "Design what you ask" },
];

export default function GuestsPage() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState<string | null>(null);

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

  const stats = guests ? guestStats(guests) : null;

  const filtered = useMemo(() => {
    if (!guests) return [];
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      const status = g.rsvps?.status ?? "pending";
      if (filter === "coming" && status !== "attending") return false;
      if (filter === "waiting" && status !== "pending") return false;
      if (filter === "declined" && status !== "declined") return false;
      if (!q) return true;
      const hay = `${g.first_name ?? ""} ${g.last_name ?? ""} ${g.email ?? ""} ${g.guest_group ?? ""} ${g.role ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [guests, query, filter]);

  const waitingWithEmail = useMemo(() => {
    return (guests ?? []).filter(
      (g) => (g.rsvps?.status ?? "pending") === "pending" && !!g.email,
    );
  }, [guests]);

  if (!wedding) return null;

  const sendReminders = async () => {
    if (waitingWithEmail.length === 0) return;
    setReminderBusy(true);
    setReminderNote(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const to = waitingWithEmail.map((g) => g.email!).filter(Boolean).join(",");
      const partners = [wedding.partner_one, wedding.partner_two]
        .filter(Boolean)
        .join(" & ") || "the couple";
      const subject = `A gentle nudge — RSVP for ${partners}`;
      const linksLine =
        waitingWithEmail.length === 1
          ? `\nHere's your invitation link: ${origin}/rsvp/${waitingWithEmail[0].invite_token}\n`
          : "\nYour personal invitation link is inside the email we sent — reply to this if you need it again.\n";
      const body = `Hi there,\n\nJust a friendly note — we'd love to know if you can join us${linksLine}\nThank you!\n${partners}`;
      const mailto = `mailto:?bcc=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await markRemindersSent(waitingWithEmail.map((g) => g.id));
      // Refresh the local list so timestamps reflect what we just wrote.
      const fresh = await fetchGuests(wedding.id);
      setGuests(fresh);
      if (typeof window !== "undefined") window.location.href = mailto;
      setReminderNote(
        `Opened your email app with ${waitingWithEmail.length} recipient${waitingWithEmail.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setReminderNote(
        err instanceof Error ? err.message : "Couldn't send reminders.",
      );
    } finally {
      setReminderBusy(false);
    }
  };

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

      {/* Real reminder nudge (only when there's a real "waiting" cohort we can email) */}
      {stats && stats.waiting > 0 && (
        <div style={{ marginTop: 14 }}>
          <UnionNote
            action={
              <Button
                onClick={sendReminders}
                disabled={reminderBusy || waitingWithEmail.length === 0}
                style={{ minHeight: 38, fontSize: 12.5, padding: "0 13px" }}
              >
                {reminderBusy ? "Opening…" : "Send a nudge"}
              </Button>
            }
          >
            {waitingWithEmail.length > 0 ? (
              <>
                Want me to gently remind the{" "}
                <b style={{ color: T.ink }}>
                  {waitingWithEmail.length} still deciding
                </b>
                ? I'll open your email with them all.
              </>
            ) : (
              <>
                <b style={{ color: T.ink }}>{stats.waiting}</b> guests still haven't
                RSVP'd. Add an email to nudge them, or copy their invite link from the
                guest page.
              </>
            )}
          </UnionNote>
          {reminderNote && (
            <div
              style={{
                fontSize: 12,
                color: T.faint,
                marginTop: 8,
                padding: "0 4px",
              }}
            >
              {reminderNote}
            </div>
          )}
        </div>
      )}

      {/* Planning tools — now operational */}
      <SectionLabel>Planning tools</SectionLabel>
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

      {guests !== null && guests.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {(
              [
                ["all", "All", stats?.invited],
                ["coming", "Coming", stats?.coming],
                ["waiting", "Waiting", stats?.waiting],
                ["declined", "Can't", stats?.declined],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Chip active={filter === key}>
                  {label}
                  {typeof n === "number" && n > 0 ? ` · ${n}` : ""}
                </Chip>
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, group…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 15px",
              borderRadius: 14,
              border: `1px solid ${T.line3}`,
              background: "#fff",
              fontFamily: T.sans,
              fontSize: 14,
              color: T.ink,
              marginBottom: 12,
            }}
          />
        </>
      )}

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
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "22px 20px" }}>
          <div style={{ fontSize: 14, color: T.muted }}>
            No matching guests.
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((g) => {
            const status = g.rsvps?.status ?? "pending";
            const group = g.guest_group ? ` · ${g.guest_group}` : "";
            const role = g.role ? ` · ${g.role}` : "";
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
                    {role}
                  </div>
                </div>
                <span
                  aria-label={status}
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
