"use client";

import React, { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import type { SeatingTable } from "@union/shared";
import {
  addSeatingTable,
  deleteSeatingTable,
  fetchGuests,
  fetchSeatingTables,
  updateGuest,
  updateSeatingTable,
  type GuestWithRsvp,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, SectionLabel, UnionNote, Button, Loading } from "@/components/ui";

type ToneKey = "accent" | "green" | "amber" | "sand";

const TONE_STYLE: Record<
  ToneKey,
  { bg: string; ring: string; fg: string }
> = {
  accent: { bg: "#F2E1E0", ring: "#C79BA0", fg: T.accentInk },
  green: { bg: "#E7EFE6", ring: "#A9C0AC", fg: T.greenInk },
  amber: { bg: "#FBEEE2", ring: "#DDB27C", fg: T.amberInk },
  sand: { bg: "#F4EFE9", ring: "#C1B4AD", fg: T.sand },
};

const LEGEND: { label: string; tone: ToneKey; dashed?: boolean }[] = [
  { label: "Family", tone: "accent" },
  { label: "Friends", tone: "green" },
  { label: "Work & neighbors", tone: "amber" },
  { label: "Open seats", tone: "sand", dashed: true },
];

export default function SeatingPage() {
  const { wedding } = useWedding();
  const [view, setView] = useState<"reception" | "ceremony">("reception");
  const [tables, setTables] = useState<SeatingTable[] | null>(null);
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // New-table form state
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState("8");
  const [newTone, setNewTone] = useState<ToneKey>("accent");

  const reload = async () => {
    if (!wedding) return;
    const [ts, gs] = await Promise.all([
      fetchSeatingTables(wedding.id),
      fetchGuests(wedding.id),
    ]);
    setTables(ts);
    setGuests(gs);
  };

  useEffect(() => {
    reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Couldn't load seating."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedding?.id]);

  const guestsByTable = useMemo(() => {
    const map = new Map<string, GuestWithRsvp[]>();
    for (const g of guests ?? []) {
      if (!g.seating_table_id) continue;
      const list = map.get(g.seating_table_id) ?? [];
      list.push(g);
      map.set(g.seating_table_id, list);
    }
    return map;
  }, [guests]);

  const unassigned = useMemo(
    () => (guests ?? []).filter((g) => !g.seating_table_id),
    [guests],
  );

  const placed = (guests ?? []).length - unassigned.length;

  const selectedTable = useMemo(
    () => (tables ?? []).find((t) => t.id === selected) ?? null,
    [tables, selected],
  );

  const selectedMembers = useMemo(
    () => (selected ? guestsByTable.get(selected) ?? [] : []),
    [selected, guestsByTable],
  );

  if (!wedding) return null;

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const total = (tables ?? []).length;
      const x = 25 + (total % 4) * 20;
      const y = 35 + Math.floor(total / 4) * 25;
      const created = await addSeatingTable({
        wedding_id: wedding.id,
        name: newName.trim(),
        capacity: Math.max(1, parseInt(newCapacity, 10) || 8),
        tone: newTone,
        x_pct: x,
        y_pct: y,
      });
      setShowNew(false);
      setNewName("");
      setNewCapacity("8");
      setNewTone("accent");
      await reload();
      setSelected(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add table.");
    } finally {
      setBusy(false);
    }
  };

  const removeTable = async (t: SeatingTable) => {
    const n = guestsByTable.get(t.id)?.length ?? 0;
    if (
      !confirm(
        n > 0
          ? `Delete "${t.name}"? ${n} guest${n === 1 ? "" : "s"} will be unseated.`
          : `Delete "${t.name}"?`,
      )
    )
      return;
    try {
      await deleteSeatingTable(t.id);
      if (selected === t.id) setSelected(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  };

  const moveTable = async (t: SeatingTable, dx: number, dy: number) => {
    const nx = clampPct(Number(t.x_pct) + dx);
    const ny = clampPct(Number(t.y_pct) + dy);
    if (nx === Number(t.x_pct) && ny === Number(t.y_pct)) return;
    try {
      await updateSeatingTable(t.id, { x_pct: nx, y_pct: ny });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move.");
    }
  };

  const assignGuest = async (guestId: string, tableId: string | null) => {
    try {
      await updateGuest(guestId, { seating_table_id: tableId });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign.");
    }
  };

  const loading = tables === null || guests === null;

  return (
    <main className="u-main">
      <BackHeader
        title="Seating"
        subtitle={
          guests
            ? `${placed} of ${guests.length} placed`
            : "Loading…"
        }
        fallback="/guests"
      />

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "#EFE7DF",
          borderRadius: 14,
          padding: 4,
        }}
      >
        {(["ceremony", "reception"] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                textAlign: "center",
                cursor: "pointer",
                background: on ? "#fff" : "transparent",
                borderRadius: 11,
                border: "none",
                padding: "9px 0",
                fontWeight: 600,
                fontSize: 13,
                color: on ? T.ink : T.faint,
                boxShadow: on ? "0 2px 6px rgba(67,53,58,.06)" : "none",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Loading label="Loading seating…" />
      ) : view === "reception" ? (
        <>
          <div
            style={{
              marginTop: 16,
              position: "relative",
              height: 320,
              borderRadius: 22,
              background: "#F7F0EA",
              border: "1px solid rgba(67,53,58,.09)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 11,
                left: 14,
                fontWeight: 600,
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#C1B4AD",
              }}
            >
              The barn · head of room
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "14%",
                transform: "translate(-50%,-50%)",
                width: 92,
                height: 30,
                borderRadius: 8,
                background: T.accentSoft,
                border: `1.5px solid ${T.accentBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 10,
                color: T.accentInk,
              }}
            >
              Sweethearts
            </div>
            {(tables ?? []).length === 0 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.faint,
                  fontSize: 13,
                  padding: 20,
                  textAlign: "center",
                }}
              >
                No tables yet. Add one below to start placing guests.
              </div>
            ) : (
              (tables ?? []).map((t) => {
                const style =
                  TONE_STYLE[(t.tone as ToneKey) in TONE_STYLE ? (t.tone as ToneKey) : "accent"];
                const seated = guestsByTable.get(t.id)?.length ?? 0;
                const full = seated >= t.capacity;
                const on = selected === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    style={{
                      position: "absolute",
                      left: `${Number(t.x_pct)}%`,
                      top: `${Number(t.y_pct)}%`,
                      transform: "translate(-50%,-50%)",
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      background: style.bg,
                      border: `1.5px ${seated === 0 ? "dashed" : "solid"} ${style.ring}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.serif,
                      fontWeight: 700,
                      fontSize: 15,
                      color: style.fg,
                      cursor: "pointer",
                      outline: on ? `2px solid ${T.ink}` : "none",
                      outlineOffset: 2,
                    }}
                    title={`${t.name} · ${seated}/${t.capacity} seated${full ? " (full)" : ""}`}
                  >
                    {t.name}
                  </button>
                );
              })
            )}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "57%",
                transform: "translate(-50%,-50%)",
                width: 96,
                height: 66,
                border: "1.5px dashed rgba(67,53,58,.2)",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontWeight: 600,
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.label,
                lineHeight: 1.35,
              }}
            >
              Dance
              <br />
              floor
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 13,
              marginTop: 13,
              padding: "0 4px",
            }}
          >
            {LEGEND.map((l) => {
              const s = TONE_STYLE[l.tone];
              return (
                <span
                  key={l.label}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: s.bg,
                      border: `1.5px ${l.dashed ? "dashed" : "solid"} ${s.ring}`,
                    }}
                  />
                  <span
                    style={{ fontWeight: 500, fontSize: 11.5, color: T.muted2 }}
                  >
                    {l.label}
                  </span>
                </span>
              );
            })}
          </div>

          {selectedTable && (
            <div style={{ marginTop: 14 }}>
              <Card style={{ padding: 15 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      className="u-serif"
                      style={{ fontWeight: 600, fontSize: 20, color: T.ink }}
                    >
                      Table {selectedTable.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                      {selectedMembers.length} of {selectedTable.capacity}{" "}
                      seated
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="u-link"
                    style={{ fontSize: 13 }}
                  >
                    Close
                  </button>
                </div>

                {/* Nudge controls */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    ["◀", -5, 0],
                    ["▲", 0, -5],
                    ["▼", 0, 5],
                    ["▶", 5, 0],
                  ].map(([glyph, dx, dy], i) => (
                    <button
                      key={i}
                      onClick={() =>
                        moveTable(selectedTable, dx as number, dy as number)
                      }
                      style={{
                        width: 36,
                        height: 32,
                        border: `1px solid ${T.line3}`,
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 11,
                        color: T.muted,
                      }}
                    >
                      {glyph}
                    </button>
                  ))}
                  <button
                    onClick={() => removeTable(selectedTable)}
                    className="u-link"
                    style={{ color: "#C0553B", fontSize: 12, marginLeft: 8 }}
                  >
                    Delete table
                  </button>
                </div>

                {/* Seated */}
                {selectedMembers.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {selectedMembers.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 8px",
                          borderRadius: 10,
                          background: "#FFFCFA",
                          border: `1px solid ${T.line}`,
                        }}
                      >
                        <div style={{ flex: 1, fontSize: 13, color: T.ink }}>
                          {m.first_name} {m.last_name ?? ""}
                        </div>
                        <button
                          onClick={() => assignGuest(m.id, null)}
                          className="u-link"
                          style={{ fontSize: 12, color: T.muted2 }}
                        >
                          Unseat
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add-from-unassigned */}
                {unassigned.length > 0 &&
                  selectedMembers.length < selectedTable.capacity && (
                    <div style={{ marginTop: 12 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: T.muted,
                        }}
                      >
                        Seat someone here
                      </label>
                      <select
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) assignGuest(id, selectedTable.id);
                          e.currentTarget.value = "";
                        }}
                        style={{
                          marginTop: 4,
                          minHeight: 40,
                          padding: "6px 12px",
                          fontSize: 14,
                        }}
                      >
                        <option value="">Choose a guest…</option>
                        {unassigned.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.first_name} {g.last_name ?? ""}
                            {g.guest_group ? ` · ${g.guest_group}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              </Card>
            </div>
          )}

          {/* Add new table */}
          <div style={{ marginTop: 14 }}>
            {showNew ? (
              <Card style={{ padding: 15 }}>
                <form
                  onSubmit={submitNew}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div className="field">
                    <label htmlFor="tn">Table name</label>
                    <input
                      id="tn"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="tc">Seats</label>
                    <input
                      id="tc"
                      type="number"
                      min={1}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(e.target.value)}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {(Object.keys(TONE_STYLE) as ToneKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewTone(k)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                          border: `1px solid ${newTone === k ? T.accentBorder : T.line3}`,
                          background:
                            newTone === k ? T.accentSoft : "#fff",
                          color: T.ink,
                          textTransform: "capitalize",
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button
                      type="submit"
                      disabled={busy || !newName.trim()}
                      style={{ flex: 1 }}
                    >
                      {busy ? "Adding…" : "Add table"}
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
              <Button
                variant="secondary"
                onClick={() => setShowNew(true)}
                style={{ width: "100%" }}
              >
                + Add a table
              </Button>
            )}
          </div>

          {unassigned.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <UnionNote>
                <b style={{ color: T.ink }}>
                  {unassigned.length} guest{unassigned.length === 1 ? "" : "s"}
                </b>{" "}
                still need a table. Tap a table above to seat them.
              </UnionNote>
            </div>
          )}
        </>
      ) : (
        // Ceremony view — layout-only guide with real seat count
        <>
          <Card
            style={{
              marginTop: 16,
              background: "#F7F0EA",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 132,
                  height: 54,
                  border: `2px solid ${T.accentBorder}`,
                  borderBottom: "none",
                  borderRadius: "132px 132px 0 0",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 8,
                  fontWeight: 600,
                  fontSize: 9.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: T.accentInk,
                }}
              >
                The arch
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 6px 10px",
              }}
            >
              <span
                style={{ fontWeight: 600, fontSize: 11, color: T.muted2 }}
              >
                {wedding.partner_one ?? "Partner"}&apos;s side
              </span>
              <span
                style={{ fontWeight: 600, fontSize: 11, color: T.muted2 }}
              >
                {wedding.partner_two ?? "Partner"}&apos;s side
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  borderLeft: "1.5px dashed rgba(67,53,58,.16)",
                  transform: "translateX(-50%)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  position: "relative",
                }}
              >
                {Array.from({ length: 6 }).map((_, r) => (
                  <div key={r} style={{ display: "flex", gap: 26 }}>
                    {[0, 1].map((c) => (
                      <div
                        key={c}
                        style={{
                          flex: 1,
                          height: r === 0 ? 18 : 16,
                          borderRadius: r === 0 ? 6 : 5,
                          background:
                            r === 0 ? T.accentSoft : "#EBE1D8",
                          border:
                            r === 0
                              ? `1px solid ${T.accentBorder}`
                              : "1px solid rgba(67,53,58,.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: 8.5,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: T.accentInk,
                        }}
                      >
                        {r === 0 ? "Reserved" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
            <Card style={{ flex: 1, padding: "12px 14px" }}>
              <div
                className="u-serif"
                style={{
                  fontWeight: 600,
                  fontSize: 22,
                  color: T.ink,
                  lineHeight: 1,
                }}
              >
                {(guests ?? []).reduce(
                  (s, g) => s + (g.party_size ?? 1),
                  0,
                )}
              </div>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 11.5,
                  color: T.faint,
                  marginTop: 3,
                }}
              >
                seats needed
              </div>
            </Card>
            <Card style={{ flex: 1, padding: "12px 14px" }}>
              <div
                className="u-serif"
                style={{
                  fontWeight: 600,
                  fontSize: 22,
                  color: T.ink,
                  lineHeight: 1,
                }}
              >
                {placed}
              </div>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 11.5,
                  color: T.faint,
                  marginTop: 3,
                }}
              >
                placed at tables
              </div>
            </Card>
          </div>
        </>
      )}

      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </main>
  );
}

function clampPct(v: number): number {
  if (v < 8) return 8;
  if (v > 92) return 92;
  return Math.round(v * 10) / 10;
}
