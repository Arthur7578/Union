"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import type { RoomBlock } from "@union/shared";
import {
  addRoomBlock,
  deleteRoomBlock,
  fetchGuests,
  fetchRoomBlocks,
  updateGuest,
  updateRoomBlock,
  type GuestWithRsvp,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import {
  Card,
  SectionLabel,
  ProgressBar,
  Avatar,
  StatusPill,
  Button,
  Loading,
} from "@/components/ui";

const TONES = ["accent", "green", "amber", "sand"] as const;

export default function StaysPage() {
  const { wedding } = useWedding();
  const [rooms, setRooms] = useState<RoomBlock[] | null>(null);
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCapacity, setNewCapacity] = useState("12");
  const [newBooked, setNewBooked] = useState("0");
  const [newStatus, setNewStatus] = useState("Held");
  const [newTone, setNewTone] = useState<(typeof TONES)[number]>("accent");

  const reload = async () => {
    if (!wedding) return;
    const [rb, gs] = await Promise.all([
      fetchRoomBlocks(wedding.id),
      fetchGuests(wedding.id),
    ]);
    setRooms(rb);
    setGuests(gs);
  };

  useEffect(() => {
    reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Couldn't load stays."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedding?.id]);

  const roomsById = useMemo(() => {
    const map = new Map<string, RoomBlock>();
    for (const r of rooms ?? []) map.set(r.id, r);
    return map;
  }, [rooms]);

  const guestsByRoom = useMemo(() => {
    const map = new Map<string, GuestWithRsvp[]>();
    for (const g of guests ?? []) {
      if (!g.room_block_id) continue;
      const list = map.get(g.room_block_id) ?? [];
      list.push(g);
      map.set(g.room_block_id, list);
    }
    return map;
  }, [guests]);

  const unassigned = useMemo(
    () => (guests ?? []).filter((g) => !g.room_block_id),
    [guests],
  );

  const totalHeld = (rooms ?? []).reduce(
    (s, r) => s + (r.capacity_rooms ?? 0),
    0,
  );
  const totalBooked = (rooms ?? []).reduce(
    (s, r) => s + (r.booked_rooms ?? 0),
    0,
  );

  if (!wedding) return null;

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addRoomBlock({
        wedding_id: wedding.id,
        name: newName,
        note: newNote.trim() || null,
        price_note: newPrice.trim() || null,
        status: newStatus.trim() || null,
        capacity_rooms: Math.max(0, parseInt(newCapacity, 10) || 0),
        booked_rooms: Math.max(0, parseInt(newBooked, 10) || 0),
        tone: newTone,
      });
      setShowNew(false);
      setNewName("");
      setNewNote("");
      setNewPrice("");
      setNewCapacity("12");
      setNewBooked("0");
      setNewStatus("Held");
      setNewTone("accent");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add room block.");
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = async (r: RoomBlock) => {
    const n = guestsByRoom.get(r.id)?.length ?? 0;
    if (
      !confirm(
        n > 0
          ? `Delete "${r.name}"? ${n} guest${n === 1 ? "" : "s"} will be unassigned.`
          : `Delete "${r.name}"?`,
      )
    )
      return;
    try {
      await deleteRoomBlock(r.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  };

  const bumpBooked = async (r: RoomBlock, delta: number) => {
    const next = Math.max(0, Math.min(r.capacity_rooms, r.booked_rooms + delta));
    if (next === r.booked_rooms) return;
    try {
      await updateRoomBlock(r.id, { booked_rooms: next });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update.");
    }
  };

  const setGuestRoom = async (guestId: string, room_block_id: string | null) => {
    try {
      await updateGuest(guestId, { room_block_id });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move guest.");
    }
  };

  const loading = rooms === null || guests === null;

  return (
    <main className="u-main">
      <BackHeader
        title="Stays"
        subtitle={
          rooms
            ? `${totalHeld} rooms held · ${totalBooked} booked`
            : "Loading…"
        }
        fallback="/guests"
      />

      <SectionLabel style={{ marginTop: 8 }}>Room blocks</SectionLabel>
      {loading ? (
        <Loading label="Loading stays…" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {(rooms ?? []).map((b) => {
            const pct = b.capacity_rooms > 0
              ? Math.round((b.booked_rooms / b.capacity_rooms) * 100)
              : 0;
            const tone: "green" | "accent" =
              b.tone === "green" ? "green" : "accent";
            return (
              <Card key={b.id} style={{ padding: 16 }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 13 }}
                >
                  <Avatar
                    letter={(b.name || "?").charAt(0).toUpperCase()}
                    tint={tone}
                    square
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="u-serif"
                      style={{
                        fontWeight: 600,
                        fontSize: 18,
                        color: T.ink,
                        lineHeight: 1.1,
                      }}
                    >
                      {b.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                      {[b.price_note, b.note].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {b.status && (
                    <StatusPill tone={tone}>{b.status}</StatusPill>
                  )}
                </div>
                <div style={{ marginTop: 13 }}>
                  <ProgressBar
                    pct={pct}
                    color={tone === "green" ? T.green : T.accent}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <span
                    style={{ fontWeight: 500, fontSize: 12, color: T.faint }}
                  >
                    {b.booked_rooms} of {b.capacity_rooms} booked
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => bumpBooked(b, -1)}
                      className="u-link"
                      style={{
                        color: T.muted2,
                        fontSize: 13,
                        padding: "0 6px",
                      }}
                    >
                      −
                    </button>
                    <button
                      onClick={() => bumpBooked(b, +1)}
                      className="u-link"
                      style={{
                        color: T.accentInk,
                        fontSize: 13,
                        padding: "0 6px",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeRoom(b)}
                      className="u-link"
                      style={{ color: "#C0553B", fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}

          {showNew ? (
            <Card style={{ padding: 16 }}>
              <form
                onSubmit={submitNew}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div className="field">
                  <label htmlFor="rn">Name</label>
                  <input
                    id="rn"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Wildflower Inn"
                  />
                </div>
                <div className="field">
                  <label htmlFor="rp">Price / detail</label>
                  <input
                    id="rp"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="$140/night · 5 min from the barn"
                  />
                </div>
                <div className="field">
                  <label htmlFor="rnt">Note</label>
                  <input
                    id="rnt"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Block held until Aug 20"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="rc">Capacity</label>
                    <input
                      id="rc"
                      type="number"
                      min={0}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="rbk">Booked</label>
                    <input
                      id="rbk"
                      type="number"
                      min={0}
                      value={newBooked}
                      onChange={(e) => setNewBooked(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="rs">Status</label>
                  <input
                    id="rs"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    placeholder="Held / Full / Waitlist"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTone(t)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 20,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                        border: `1px solid ${newTone === t ? T.accentBorder : T.line3}`,
                        background: newTone === t ? T.accentSoft : "#fff",
                        color: T.ink,
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <Button
                    type="submit"
                    disabled={busy || !newName.trim()}
                    style={{ flex: 1 }}
                  >
                    {busy ? "Adding…" : "Add block"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowNew(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card
              soft
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
              onClick={() => setShowNew(true)}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: T.sandBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 600,
                  fontSize: 20,
                  color: T.sand,
                  lineHeight: 0,
                }}
              >
                +
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.muted }}>
                  Add a room block
                </div>
                <div style={{ fontSize: 12, color: T.faint }}>
                  Hold a set of rooms and start assigning guests
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {(rooms ?? []).length > 0 && (
        <>
          <SectionLabel>Who&apos;s staying where</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(guests ?? [])
              .filter((g) => g.room_block_id)
              .map((s) => {
                const rb = roomsById.get(s.room_block_id!);
                return (
                  <Card
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 15px",
                    }}
                  >
                    <Avatar
                      letter={(s.first_name || "?").charAt(0).toUpperCase()}
                      tint="accent"
                      size={36}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: T.ink,
                        }}
                      >
                        {s.first_name} {s.last_name ?? ""}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.faint,
                          marginTop: 1,
                        }}
                      >
                        {rb?.name ?? "Unknown block"}
                      </div>
                    </div>
                    <select
                      value={s.room_block_id ?? ""}
                      onChange={(e) =>
                        setGuestRoom(s.id, e.target.value || null)
                      }
                      style={{
                        minHeight: 32,
                        padding: "4px 8px",
                        fontSize: 12,
                        maxWidth: 130,
                      }}
                    >
                      <option value="">— Unassigned —</option>
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </Card>
                );
              })}
          </div>

          {unassigned.length > 0 && (
            <>
              <SectionLabel>Not yet assigned</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {unassigned.slice(0, 30).map((s) => (
                  <Card
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 15px",
                    }}
                  >
                    <Avatar
                      letter={(s.first_name || "?").charAt(0).toUpperCase()}
                      tint="sand"
                      size={30}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: T.ink,
                        }}
                      >
                        {s.first_name} {s.last_name ?? ""}
                      </div>
                      <div
                        style={{ fontSize: 12, color: T.faint, marginTop: 1 }}
                      >
                        Party of {s.party_size ?? 1}
                      </div>
                    </div>
                    <select
                      value=""
                      onChange={(e) =>
                        setGuestRoom(s.id, e.target.value || null)
                      }
                      style={{
                        minHeight: 32,
                        padding: "4px 8px",
                        fontSize: 12,
                        maxWidth: 140,
                      }}
                    >
                      <option value="">Assign to…</option>
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </Card>
                ))}
                {unassigned.length > 30 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: T.faint,
                      padding: "0 4px",
                    }}
                  >
                    …and {unassigned.length - 30} more. Assign one at a time
                    from the{" "}
                    <Link href="/guests" style={{ color: T.accentInk }}>
                      guest list
                    </Link>
                    .
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
