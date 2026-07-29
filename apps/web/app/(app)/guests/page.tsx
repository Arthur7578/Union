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
import { useT } from "@/lib/i18n/client";

type Filter = "all" | "coming" | "waiting" | "declined";

const STATUS_DOT: Record<string, string> = {
  attending: T.green,
  declined: "#C7A9A2",
  pending: "#DDB27C",
};

export default function GuestsPage() {
  const t = useT();
  const TOOLS = [
    {
      href: "/guests/groups",
      label: t.guests.tools.groupsLabel,
      sub: t.guests.tools.groupsSub,
    },
    {
      href: "/guests/seating",
      label: t.guests.tools.seatingLabel,
      sub: t.guests.tools.seatingSub,
    },
    {
      href: "/guests/stays",
      label: t.guests.tools.staysLabel,
      sub: t.guests.tools.staysSub,
    },
    {
      href: "/guests/rsvp-form",
      label: t.guests.tools.formLabel,
      sub: t.guests.tools.formSub,
    },
  ];
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
      const partners =
        [wedding.partner_one, wedding.partner_two]
          .filter(Boolean)
          .join(" & ") || t.guests.theCouple;
      const subject = t.guests.emailSubject(partners);
      const linksLine =
        waitingWithEmail.length === 1
          ? t.guests.emailBody.singleLink(
              `${origin}/rsvp/${waitingWithEmail[0].invite_token}`,
            )
          : t.guests.emailBody.multipleLinks;
      const body = `${t.guests.emailBody.hello}\n\n${t.guests.emailBody.lead}${linksLine}\n${t.guests.emailBody.thanks}\n${partners}`;
      const mailto = `mailto:?bcc=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await markRemindersSent(waitingWithEmail.map((g) => g.id));
      const fresh = await fetchGuests(wedding.id);
      setGuests(fresh);
      if (typeof window !== "undefined") window.location.href = mailto;
      setReminderNote(t.guests.reminderSummary(waitingWithEmail.length));
    } catch (err) {
      setReminderNote(
        err instanceof Error ? err.message : t.guests.reminderFail,
      );
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <main className="u-main">
      <PageHeader
        kicker={stats ? `${stats.invited} ${t.guests.kicker}` : t.guests.kickerFallback}
        title={t.guests.title}
        right={
          <Link href="/guests/new">
            <Button style={{ minHeight: 40, fontSize: 14 }}>
              {t.guests.addShort}
            </Button>
          </Link>
        }
      />

      {/* Real stat tiles */}
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <StatTile
          value={stats?.coming}
          label={t.today.guestStatsComing}
          bg={T.greenBg}
          fg={T.greenDeep}
        />
        <StatTile
          value={stats?.declined}
          label={t.today.guestStatsCant}
          bg={T.roseBg}
          fg={T.rose}
        />
        <StatTile
          value={stats?.waiting}
          label={t.today.guestStatsWaiting}
          bg={T.amberBg}
          fg={T.amberInk}
        />
      </div>

      {stats && stats.waiting > 0 && (
        <div style={{ marginTop: 14 }}>
          <UnionNote
            action={
              <Button
                onClick={sendReminders}
                disabled={reminderBusy || waitingWithEmail.length === 0}
                style={{ minHeight: 38, fontSize: 12.5, padding: "0 13px" }}
              >
                {reminderBusy ? t.guests.opening : t.guests.sendNudge}
              </Button>
            }
          >
            {waitingWithEmail.length > 0 ? (
              <>
                {t.guests.reminderPromptLead}{" "}
                <b style={{ color: T.ink }}>
                  {t.guests.reminderPromptStrong(waitingWithEmail.length)}
                </b>
                {t.guests.reminderPromptTail}
              </>
            ) : (
              <>
                {t.guests.reminderNoEmail.before}
                <b style={{ color: T.ink }}>
                  {t.guests.reminderNoEmail.strong(stats.waiting)}
                </b>
                {t.guests.reminderNoEmail.after}
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

      {/* Planning tools */}
      <SectionLabel>{t.guests.planningTools}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card onClick={() => {}} style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                {tool.label}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                {tool.sub}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Real guest list */}
      <SectionLabel>{t.guests.guestList}</SectionLabel>

      {guests !== null && guests.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {(
              [
                ["all", t.guests.filterAll, stats?.invited],
                ["coming", t.guests.filterComing, stats?.coming],
                ["waiting", t.guests.filterWaiting, stats?.waiting],
                ["declined", t.guests.filterCant, stats?.declined],
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
            placeholder={t.guests.searchPlaceholder}
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
        <Loading label={t.guests.loadingList} />
      ) : guests.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div className="u-serif" style={{ fontSize: 22, color: T.ink }}>
            {t.guests.noGuestsTitle}
          </div>
          <div style={{ fontSize: 14, color: T.muted, margin: "6px 0 16px" }}>
            {t.guests.noGuestsBody}
          </div>
          <Link href="/guests/new">
            <Button>{t.guests.add}</Button>
          </Link>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "22px 20px" }}>
          <div style={{ fontSize: 14, color: T.muted }}>
            {t.guests.noMatches}
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
                    {t.guests.partyOf(g.party_size ?? 1)}
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
      <div
        className="u-serif"
        style={{ fontWeight: 600, fontSize: 28, color: fg, lineHeight: 1 }}
      >
        {value ?? "—"}
      </div>
      <div style={{ fontWeight: 600, fontSize: 11, color: fg, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
