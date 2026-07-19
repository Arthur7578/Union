"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import type { RoomBlock, RsvpStatus, SeatingTable } from "@union/shared";
import {
  clearRsvp,
  deleteGuest,
  fetchGuest,
  fetchGuestGroups,
  fetchRoomBlocks,
  fetchSeatingTables,
  updateGuest,
  upsertRsvp,
  type GuestWithRsvp,
} from "@/lib/data";
import { useWedding } from "@/lib/wedding";
import { Button, Card, SectionLabel, Loading, StatusPill } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

const STATUS_LABEL: Record<
  string,
  { text: string; tone: "green" | "amber" | "sand" }
> = {
  attending: { text: "Attending", tone: "green" },
  declined: { text: "Can't make it", tone: "sand" },
  pending: { text: "Awaiting reply", tone: "amber" },
};

const SUGGESTED_ROLES = [
  "Maid of honor",
  "Best man",
  "Bridesmaid",
  "Groomsman",
  "Officiant",
  "Ring bearer",
  "Flower girl",
  "Witness",
];

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { wedding } = useWedding();
  const [guest, setGuest] = useState<GuestWithRsvp | null | undefined>(undefined);

  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [roomBlockId, setRoomBlockId] = useState<string>("");
  const [seatingTableId, setSeatingTableId] = useState<string>("");

  // RSVP recording form (owner side).
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | "">("");
  const [rsvpCount, setRsvpCount] = useState<string>("");
  const [rsvpDiet, setRsvpDiet] = useState("");
  const [rsvpMessage, setRsvpMessage] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpNote, setRsvpNote] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomBlock[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchGuest(id)
      .then((g) => {
        setGuest(g);
        if (g) {
          setFirstNameV(g.first_name);
          setLastName(g.last_name ?? "");
          setEmail(g.email ?? "");
          setPhone(g.phone ?? "");
          setPartySize(String(g.party_size ?? 1));
          setGroup(g.guest_group ?? "");
          setRole(g.role ?? "");
          setNotes(g.notes ?? "");
          setRoomBlockId(g.room_block_id ?? "");
          setSeatingTableId(g.seating_table_id ?? "");
          if (g.rsvps) {
            setRsvpStatus(g.rsvps.status);
            setRsvpCount(
              g.rsvps.num_attending != null ? String(g.rsvps.num_attending) : "",
            );
            setRsvpDiet(g.rsvps.dietary_notes ?? "");
            setRsvpMessage(g.rsvps.message ?? "");
          }
        }
      })
      .catch(() => setGuest(null));
  }, [id]);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    Promise.all([
      fetchGuestGroups(wedding.id),
      fetchRoomBlocks(wedding.id),
      fetchSeatingTables(wedding.id),
    ])
      .then(([gs, rb, st]) => {
        if (!ok) return;
        setGroupNames(gs.map((g) => g.name));
        setRooms(rb);
        setTables(st);
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [wedding]);

  const groupOptions = useMemo(() => {
    // Merge stored group meta with the free-text one on this guest, dedup.
    const set = new Set<string>(groupNames);
    if (group) set.add(group);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [groupNames, group]);

  if (guest === undefined)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );
  if (!guest)
    return (
      <main className="u-main">
        <BackHeader title="Guest not found" fallback="/guests" />
      </main>
    );

  const status = guest.rsvps?.status ?? "pending";
  const sl = STATUS_LABEL[status];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateGuest(guest.id, {
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        party_size: Math.max(1, parseInt(partySize, 10) || 1),
        guest_group: group.trim() || null,
        role: role.trim() || null,
        notes: notes.trim() || null,
        room_block_id: roomBlockId || null,
        seating_table_id: seatingTableId || null,
      });
      setGuest((prev) => (prev ? { ...prev, ...updated } : prev));
      setBusy(false);
      setError(null);
      setRsvpNote("Saved.");
      setTimeout(() => setRsvpNote(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${guest.first_name} from your guest list?`)) return;
    setBusy(true);
    try {
      await deleteGuest(guest.id);
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove.");
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/rsvp/${guest.invite_token}`
        : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const emailInvite = () => {
    if (!guest.email) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const partners = [wedding?.partner_one, wedding?.partner_two]
      .filter(Boolean)
      .join(" & ") || "us";
    const url = `${origin}/rsvp/${guest.invite_token}`;
    const subject = `You're invited — RSVP for ${partners}`;
    const body = `Hi ${guest.first_name},\n\nWe'd love for you to celebrate with us. Your RSVP link:\n${url}\n\nWith love,\n${partners}`;
    window.location.href = `mailto:${encodeURIComponent(guest.email)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  const saveRsvp = async () => {
    if (!rsvpStatus) return;
    setRsvpBusy(true);
    setRsvpNote(null);
    try {
      const n = rsvpCount ? parseInt(rsvpCount, 10) : null;
      const saved = await upsertRsvp({
        guest_id: guest.id,
        status: rsvpStatus as RsvpStatus,
        num_attending: rsvpStatus === "declined" ? 0 : (Number.isFinite(n as number) ? n : null),
        dietary_notes: rsvpDiet.trim() || null,
        message: rsvpMessage.trim() || null,
      });
      setGuest((prev) => (prev ? { ...prev, rsvps: saved } : prev));
      setRsvpNote("RSVP recorded.");
    } catch (err) {
      setRsvpNote(err instanceof Error ? err.message : "Couldn't record RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  };

  const clearRsvpRow = async () => {
    setRsvpBusy(true);
    setRsvpNote(null);
    try {
      await clearRsvp(guest.id);
      setGuest((prev) => (prev ? { ...prev, rsvps: null } : prev));
      setRsvpStatus("");
      setRsvpCount("");
      setRsvpDiet("");
      setRsvpMessage("");
      setRsvpNote("RSVP cleared.");
    } catch (err) {
      setRsvpNote(err instanceof Error ? err.message : "Couldn't clear RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={`${guest.first_name} ${guest.last_name ?? ""}`.trim()}
        subtitle={`Party of ${guest.party_size ?? 1}`}
        fallback="/guests"
        right={<StatusPill tone={sl.tone}>{sl.text}</StatusPill>}
      />

      {guest.rsvps && (guest.rsvps.dietary_notes || guest.rsvps.message) && (
        <Card style={{ marginBottom: 16 }}>
          {guest.rsvps.dietary_notes && (
            <div style={{ fontSize: 14, color: T.ink2 }}>
              <b>Dietary:</b> {guest.rsvps.dietary_notes}
            </div>
          )}
          {guest.rsvps.message && (
            <div
              style={{
                fontSize: 14,
                color: T.ink2,
                marginTop: guest.rsvps.dietary_notes ? 8 : 0,
              }}
            >
              <b>Note:</b> {guest.rsvps.message}
            </div>
          )}
        </Card>
      )}

      <SectionLabel style={{ marginTop: 0 }}>Invitation link</SectionLabel>
      <Card style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 140,
            fontSize: 13,
            color: T.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          /rsvp/{guest.invite_token}
        </div>
        <Button
          variant="secondary"
          onClick={copyLink}
          style={{ minHeight: 38, fontSize: 13 }}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
        {guest.email && (
          <Button
            onClick={emailInvite}
            style={{ minHeight: 38, fontSize: 13 }}
          >
            Email invite
          </Button>
        )}
      </Card>
      {guest.rsvp_reminder_sent_at && (
        <div
          style={{
            fontSize: 12,
            color: T.faint,
            marginTop: 6,
            padding: "0 4px",
          }}
        >
          Last reminder sent {new Date(guest.rsvp_reminder_sent_at).toLocaleDateString()}
        </div>
      )}

      <SectionLabel>RSVP</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>
          Record what {guest.first_name} told you — this counts toward your
          headcount immediately.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              ["attending", "Attending"],
              ["declined", "Can't make it"],
            ] as const
          ).map(([k, label]) => {
            const on = rsvpStatus === k;
            return (
              <button
                key={k}
                onClick={() => setRsvpStatus(k)}
                type="button"
                style={{
                  border: `1px solid ${on ? T.accentBorder : "rgba(67,53,58,.1)"}`,
                  background: on ? T.accentSoft : "#fff",
                  color: on ? T.ink : T.muted2,
                  padding: "7px 13px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {rsvpStatus === "attending" && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="rc">How many attending?</label>
            <input
              id="rc"
              type="number"
              min={1}
              max={guest.party_size ?? 1}
              value={rsvpCount}
              onChange={(e) => setRsvpCount(e.target.value)}
              placeholder={String(guest.party_size ?? 1)}
            />
            <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
              Party of {guest.party_size ?? 1}. Leave blank to record their whole party.
            </div>
          </div>
        )}
        {(rsvpStatus === "attending" || rsvpStatus === "declined") && (
          <>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="rd">Dietary or access notes</label>
              <input
                id="rd"
                type="text"
                value={rsvpDiet}
                onChange={(e) => setRsvpDiet(e.target.value)}
                placeholder="Vegetarian, gluten-free…"
              />
            </div>
            <div className="field">
              <label htmlFor="rm">A note from them</label>
              <input
                id="rm"
                type="text"
                value={rsvpMessage}
                onChange={(e) => setRsvpMessage(e.target.value)}
                placeholder="Can't wait!"
              />
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <Button
            onClick={saveRsvp}
            disabled={rsvpBusy || !rsvpStatus || rsvpStatus === "pending"}
            style={{ flex: 1, minWidth: 140 }}
          >
            {rsvpBusy ? "Saving…" : "Record RSVP"}
          </Button>
          {guest.rsvps && (
            <Button
              variant="secondary"
              onClick={clearRsvpRow}
              disabled={rsvpBusy}
              style={{ minWidth: 100 }}
            >
              Clear
            </Button>
          )}
        </div>
        {rsvpNote && (
          <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>
            {rsvpNote}
          </div>
        )}
      </Card>

      <SectionLabel>Details</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="fn">First name</label>
          <input
            id="fn"
            type="text"
            required
            value={firstNameV}
            onChange={(e) => setFirstNameV(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ln">Last name</label>
          <input
            id="ln"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="em">Email</label>
          <input
            id="em"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ph">Phone</label>
          <input
            id="ph"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ps">Party size</label>
          <input
            id="ps"
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="gr">Group</label>
          <input
            id="gr"
            type="text"
            list="gr-list"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="College friends"
          />
          {groupOptions.length > 0 && (
            <datalist id="gr-list">
              {groupOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
        </div>
        <div className="field">
          <label htmlFor="rl">Role in the wedding</label>
          <input
            id="rl"
            type="text"
            list="rl-list"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Maid of honor, officiant…"
          />
          <datalist id="rl-list">
            {SUGGESTED_ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        {rooms.length > 0 && (
          <div className="field">
            <label htmlFor="rb">Room block</label>
            <select
              id="rb"
              value={roomBlockId}
              onChange={(e) => setRoomBlockId(e.target.value)}
            >
              <option value="">— None —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tables.length > 0 && (
          <div className="field">
            <label htmlFor="st">Seating table</label>
            <select
              id="st"
              value={seatingTableId}
              onChange={(e) => setSeatingTableId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="nt">Notes (private to you)</label>
          <textarea
            id="nt"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Plus-one confirmed on the phone, allergic to shellfish, etc."
            rows={3}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <Button
          type="submit"
          disabled={busy || !firstNameV.trim()}
          style={{ width: "100%" }}
        >
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={remove}
            className="u-link"
            style={{ color: "#C0553B" }}
          >
            Remove guest
          </button>
        </div>
      </form>
    </main>
  );
}
