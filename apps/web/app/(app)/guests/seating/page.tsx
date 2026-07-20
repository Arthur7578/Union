"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { initial } from "@/lib/format";

type ToneKey = "accent" | "green" | "amber" | "sand";
type Shape = "round" | "rect";

const TONE_STYLE: Record<
  ToneKey,
  { bg: string; ring: string; fg: string; label: string }
> = {
  accent: { bg: "#F2E1E0", ring: "#C79BA0", fg: T.accentInk, label: "Family" },
  green: { bg: "#E7EFE6", ring: "#A9C0AC", fg: T.greenInk, label: "Friends" },
  amber: { bg: "#FBEEE2", ring: "#DDB27C", fg: T.amberInk, label: "Work & neighbors" },
  sand: { bg: "#F4EFE9", ring: "#C1B4AD", fg: T.sand, label: "Other" },
};

const TONE_KEYS = Object.keys(TONE_STYLE) as ToneKey[];

const CEREMONY_KEY = (weddingId: string) => `union:ceremony:${weddingId}`;

type CeremonyPrefs = { rows: number; reserved: number };

const DEFAULT_CEREMONY: CeremonyPrefs = { rows: 6, reserved: 1 };

function toneKey(v: string | null | undefined): ToneKey {
  return v && (v as ToneKey) in TONE_STYLE ? (v as ToneKey) : "accent";
}

/** Sum of party sizes for a list of guests — the true "seats used" number. */
function seatsUsed(gs: GuestWithRsvp[]): number {
  let n = 0;
  for (const g of gs) n += g.party_size ?? 1;
  return n;
}

/** Clamp a percentage into the visible plan (with padding). */
function clampPct(v: number, min = 8, max = 92): number {
  if (v < min) return min;
  if (v > max) return max;
  return Math.round(v * 10) / 10;
}

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
  const [newIsHead, setNewIsHead] = useState(false);
  const [newShape, setNewShape] = useState<Shape>("round");

  // Edit-table form state (only rendered when editingId matches selected)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("8");
  const [editTone, setEditTone] = useState<ToneKey>("accent");
  const [editIsHead, setEditIsHead] = useState(false);
  const [editShape, setEditShape] = useState<Shape>("round");

  // Unassigned panel state
  const [unassignedQuery, setUnassignedQuery] = useState("");

  // Ceremony prefs (per-wedding, client-side)
  const [ceremony, setCeremony] = useState<CeremonyPrefs>(DEFAULT_CEREMONY);
  const [selectedPew, setSelectedPew] = useState<{
    row: number;
    side: "left" | "right";
  } | null>(null);

  // Optional visual guide overlays on the floor plan
  const [showDanceFloor, setShowDanceFloor] = useState(true);

  // Ref to the floor-plan container, used for drag math.
  const planRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ id: string; startX: number; startY: number } | null>(
    null,
  );

  const reload = useCallback(async () => {
    if (!wedding) return;
    const [ts, gs] = await Promise.all([
      fetchSeatingTables(wedding.id),
      fetchGuests(wedding.id),
    ]);
    setTables(ts);
    setGuests(gs);
  }, [wedding]);

  useEffect(() => {
    reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Couldn't load seating."),
    );
  }, [reload]);

  // Load persisted ceremony prefs.
  useEffect(() => {
    if (!wedding || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CEREMONY_KEY(wedding.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CeremonyPrefs>;
      const rows = Math.max(2, Math.min(24, Number(parsed.rows) || DEFAULT_CEREMONY.rows));
      const reserved = Math.max(0, Math.min(rows, Number(parsed.reserved) || 0));
      setCeremony({ rows, reserved });
    } catch {
      /* ignore bad JSON */
    }
  }, [wedding]);

  const saveCeremony = (next: CeremonyPrefs) => {
    setCeremony(next);
    if (!wedding || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CEREMONY_KEY(wedding.id), JSON.stringify(next));
    } catch {
      /* storage may be blocked; ignore */
    }
  };

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

  const filteredUnassigned = useMemo(() => {
    const q = unassignedQuery.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter((g) => {
      const hay = `${g.first_name ?? ""} ${g.last_name ?? ""} ${g.guest_group ?? ""} ${g.role ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [unassigned, unassignedQuery]);

  const placedGuests = (guests ?? []).length - unassigned.length;
  const totalSeatsUsed = seatsUsed(guests ?? []) - seatsUsed(unassigned);
  const totalCapacity = (tables ?? []).reduce((s, t) => s + t.capacity, 0);

  const selectedTable = useMemo(
    () => (tables ?? []).find((t) => t.id === selected) ?? null,
    [tables, selected],
  );

  const selectedMembers = useMemo(
    () => (selected ? guestsByTable.get(selected) ?? [] : []),
    [selected, guestsByTable],
  );

  const selectedSeatsUsed = seatsUsed(selectedMembers);
  const selectedOverCap = selectedTable
    ? selectedSeatsUsed > selectedTable.capacity
    : false;

  const hasHead = (tables ?? []).some((t) => t.is_head);

  const orderedTables = useMemo(() => {
    // Render regular tables first, head table last so it draws on top.
    return [...(tables ?? [])].sort(
      (a, b) => Number(a.is_head) - Number(b.is_head),
    );
  }, [tables]);

  // Ceremony: pew index -> guests assigned to it.
  const ceremonyByPew = useMemo(() => {
    const map = new Map<string, GuestWithRsvp[]>();
    for (const g of guests ?? []) {
      if (g.ceremony_row == null || g.ceremony_side == null) continue;
      const key = `${g.ceremony_row}:${g.ceremony_side}`;
      const list = map.get(key) ?? [];
      list.push(g);
      map.set(key, list);
    }
    return map;
  }, [guests]);

  // Guests assigned to a row that's now beyond the visible layout.
  const ceremonyOffPlan = useMemo(
    () =>
      (guests ?? []).filter(
        (g) => g.ceremony_row != null && g.ceremony_row >= ceremony.rows,
      ),
    [guests, ceremony.rows],
  );

  const ceremonyAssignedCount = useMemo(
    () =>
      (guests ?? []).reduce(
        (s, g) => s + (g.ceremony_row != null ? g.party_size ?? 1 : 0),
        0,
      ),
    [guests],
  );

  const selectedPewMembers = useMemo(() => {
    if (!selectedPew) return [];
    return ceremonyByPew.get(`${selectedPew.row}:${selectedPew.side}`) ?? [];
  }, [selectedPew, ceremonyByPew]);

  if (!wedding) return null;

  // ------- Actions -------

  const openEditForSelected = () => {
    if (!selectedTable) return;
    setEditingId(selectedTable.id);
    setEditName(selectedTable.name);
    setEditCapacity(String(selectedTable.capacity));
    setEditTone(toneKey(selectedTable.tone));
    setEditIsHead(selectedTable.is_head);
    setEditShape((selectedTable.shape as Shape) === "rect" ? "rect" : "round");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateSeatingTable(editingId, {
        name: editName.trim(),
        capacity: Math.max(1, parseInt(editCapacity, 10) || 8),
        tone: editTone,
        is_head: editIsHead,
        shape: editShape,
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const total = (tables ?? []).length;
      const isHead = newIsHead && !hasHead;
      // Head tables anchor top-center; regular tables tile below.
      const x = isHead ? 50 : 25 + (total % 4) * 20;
      const y = isHead ? 16 : 38 + Math.floor(total / 4) * 22;
      const created = await addSeatingTable({
        wedding_id: wedding.id,
        name: newName.trim(),
        capacity: Math.max(1, parseInt(newCapacity, 10) || 8),
        tone: newTone,
        x_pct: x,
        y_pct: y,
        is_head: isHead,
        shape: isHead ? newShape : "round",
      });
      setShowNew(false);
      setNewName("");
      setNewCapacity("8");
      setNewTone("accent");
      setNewIsHead(false);
      setNewShape("round");
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
      if (selected === t.id) {
        setSelected(null);
        setEditingId(null);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  };

  const nudge = async (t: SeatingTable, dx: number, dy: number) => {
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

  const assignPew = async (
    guestId: string,
    row: number | null,
    side: "left" | "right" | null,
  ) => {
    try {
      await updateGuest(guestId, {
        ceremony_row: row,
        ceremony_side: side,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign pew.");
    }
  };

  const seatGroupAtSelected = async (group: string) => {
    if (!selectedTable) return;
    const targets = unassigned.filter((g) => (g.guest_group ?? "") === group);
    if (targets.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const g of targets) {
        await updateGuest(g.id, { seating_table_id: selectedTable.id });
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't seat group.");
    } finally {
      setBusy(false);
    }
  };

  // ------- Drag handlers -------

  const onTablePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    t: SeatingTable,
  ) => {
    // Only left-click / primary touch, and only on the container itself
    // (avoids stealing taps from inner buttons).
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    draggingRef.current = { id: t.id, startX: e.clientX, startY: e.clientY };
    // Select immediately so the edit affordance is one step away.
    setSelected(t.id);
  };

  const onTablePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    t: SeatingTable,
  ) => {
    const drag = draggingRef.current;
    if (!drag || drag.id !== t.id) return;
    const plan = planRef.current;
    if (!plan) return;
    const rect = plan.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const nx = clampPct(((e.clientX - rect.left) / rect.width) * 100);
    const ny = clampPct(((e.clientY - rect.top) / rect.height) * 100);
    // Live-drag by mutating local state; the release does the DB write.
    setTables((prev) => {
      if (!prev) return prev;
      return prev.map((row) =>
        row.id === t.id ? { ...row, x_pct: nx, y_pct: ny } : row,
      );
    });
  };

  const onTablePointerUp = async (
    e: React.PointerEvent<HTMLDivElement>,
    t: SeatingTable,
  ) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    if (!drag || drag.id !== t.id) return;
    const moved =
      Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 4;
    if (!moved) return; // treat as a tap; selection already happened onPointerDown
    const cur = (tables ?? []).find((row) => row.id === t.id);
    if (!cur) return;
    try {
      await updateSeatingTable(t.id, {
        x_pct: Number(cur.x_pct),
        y_pct: Number(cur.y_pct),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save move.");
      await reload();
    }
  };

  const loading = tables === null || guests === null;

  const venueLabel = (wedding.venue_name ?? "Reception").toUpperCase();

  return (
    <main className="u-main">
      <BackHeader
        title="Seating"
        subtitle={
          guests
            ? `${placedGuests} of ${guests.length} placed · ${totalSeatsUsed} of ${totalCapacity || "—"} seats`
            : "Loading…"
        }
        fallback="/guests"
      />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Seating view"
        style={{
          display: "flex",
          gap: 6,
          background: "#EFE7DF",
          borderRadius: 14,
          padding: 4,
        }}
      >
        {(["reception", "ceremony"] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={on}
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
          {/* Floor plan */}
          <div
            ref={planRef}
            style={{
              marginTop: 16,
              position: "relative",
              height: 340,
              borderRadius: 22,
              background: "#F7F0EA",
              border: "1px solid rgba(67,53,58,.09)",
              overflow: "hidden",
              touchAction: "none",
              userSelect: "none",
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
                maxWidth: "70%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={wedding.venue_name ?? undefined}
            >
              {venueLabel}
            </div>

            {/* Small "guide" toggle in the top-right */}
            <button
              onClick={() => setShowDanceFloor((v) => !v)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(255,255,255,.8)",
                border: `1px solid ${T.line3}`,
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 10.5,
                fontWeight: 600,
                color: T.muted2,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
              aria-pressed={showDanceFloor}
              title="Toggle dance-floor guide"
            >
              Dance floor {showDanceFloor ? "◉" : "○"}
            </button>

            {(tables ?? []).length === 0 && (
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
                An empty room, for now. Add your first table below.
              </div>
            )}

            {/* Optional visual dance-floor overlay (no persistence) */}
            {showDanceFloor && (tables?.length ?? 0) > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "72%",
                  transform: "translate(-50%,-50%)",
                  width: 92,
                  height: 60,
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
                  pointerEvents: "none",
                }}
              >
                Dance
                <br />
                floor
              </div>
            )}

            {orderedTables.map((t) => {
              const style = TONE_STYLE[toneKey(t.tone)];
              const seated = guestsByTable.get(t.id) ?? [];
              const used = seatsUsed(seated);
              const empty = seated.length === 0;
              const over = used > t.capacity;
              const on = selected === t.id;
              const isRect = t.is_head || t.shape === "rect";
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => onTablePointerDown(e, t)}
                  onPointerMove={(e) => onTablePointerMove(e, t)}
                  onPointerUp={(e) => onTablePointerUp(e, t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(t.id);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${Number(t.x_pct)}%`,
                    top: `${Number(t.y_pct)}%`,
                    transform: "translate(-50%,-50%)",
                    width: isRect ? 92 : 48,
                    height: isRect ? 30 : 48,
                    borderRadius: isRect ? 8 : "50%",
                    background: style.bg,
                    border: `${over ? 2 : 1.5}px ${empty ? "dashed" : "solid"} ${over ? "#C0553B" : style.ring}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.serif,
                    fontWeight: 700,
                    fontSize: isRect ? 11 : 14.5,
                    color: over ? "#C0553B" : style.fg,
                    cursor: "grab",
                    outline: on ? `2px solid ${T.ink}` : "none",
                    outlineOffset: 2,
                    textTransform: isRect ? "uppercase" : "none",
                    letterSpacing: isRect ? "0.08em" : "normal",
                    padding: isRect ? "0 8px" : 0,
                    textAlign: "center",
                    lineHeight: 1.1,
                    boxShadow: on ? "0 4px 12px rgba(67,53,58,.14)" : "none",
                    whiteSpace: "nowrap",
                  }}
                  title={`${t.name} · ${used}/${t.capacity} seated${over ? " (over)" : ""}`}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                  >
                    {t.name}
                  </span>
                  {!isRect && !empty && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -6,
                        right: -6,
                        background: over ? "#C0553B" : "#fff",
                        color: over ? "#fff" : T.muted,
                        border: `1px solid ${over ? "#C0553B" : T.line3}`,
                        borderRadius: 999,
                        padding: "1px 6px",
                        fontFamily: T.sans,
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {used}/{t.capacity}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 13,
              marginTop: 13,
              padding: "0 4px",
            }}
          >
            {TONE_KEYS.map((k) => {
              const s = TONE_STYLE[k];
              return (
                <span
                  key={k}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: s.bg,
                      border: `1.5px solid ${s.ring}`,
                    }}
                  />
                  <span
                    style={{ fontWeight: 500, fontSize: 11.5, color: T.muted2 }}
                  >
                    {s.label}
                  </span>
                </span>
              );
            })}
            <span
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Dashed = empty table"
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: "#F4EFE9",
                  border: `1.5px dashed ${T.sand}`,
                }}
              />
              <span
                style={{ fontWeight: 500, fontSize: 11.5, color: T.muted2 }}
              >
                Empty
              </span>
            </span>
          </div>

          {/* Selected-table detail card */}
          {selectedTable && (
            <div style={{ marginTop: 14 }}>
              <Card style={{ padding: 15 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="u-serif"
                      style={{
                        fontWeight: 600,
                        fontSize: 20,
                        color: T.ink,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {selectedTable.is_head ? "Head table" : "Table"} {selectedTable.name}
                      {selectedTable.is_head && (
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: T.accentSoft,
                            color: T.accentInk,
                            border: `1px solid ${T.accentBorder}`,
                          }}
                        >
                          Sweetheart
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: selectedOverCap ? "#C0553B" : T.faint,
                        marginTop: 2,
                        fontWeight: selectedOverCap ? 600 : 400,
                      }}
                    >
                      {selectedSeatsUsed} of {selectedTable.capacity} seats
                      {selectedOverCap ? " — over capacity" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setEditingId(null);
                    }}
                    className="u-link"
                    style={{ fontSize: 13 }}
                    aria-label="Close selected table"
                  >
                    Close
                  </button>
                </div>

                {editingId === selectedTable.id ? (
                  <form
                    onSubmit={submitEdit}
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="en">Name</label>
                      <input
                        id="en"
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="ec">Seats</label>
                      <input
                        id="ec"
                        type="number"
                        min={1}
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {TONE_KEYS.map((k) => {
                        const s = TONE_STYLE[k];
                        const on = editTone === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setEditTone(k)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 20,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              border: `1px solid ${on ? s.ring : T.line3}`,
                              background: on ? s.bg : "#fff",
                              color: T.ink,
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: T.muted,
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editIsHead}
                        onChange={(e) => setEditIsHead(e.target.checked)}
                        disabled={
                          hasHead && !selectedTable.is_head
                        }
                      />
                      Head table (sweetheart)
                      {hasHead && !selectedTable.is_head && (
                        <span style={{ fontSize: 11, color: T.faint }}>
                          — you already have one
                        </span>
                      )}
                    </label>
                    {editIsHead && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["rect", "round"] as Shape[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEditShape(s)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 20,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              border: `1px solid ${editShape === s ? T.accentBorder : T.line3}`,
                              background: editShape === s ? T.accentSoft : "#fff",
                              color: T.ink,
                              textTransform: "capitalize",
                            }}
                          >
                            {s === "rect" ? "Rectangle" : "Round"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <Button
                        type="submit"
                        disabled={busy || !editName.trim()}
                        style={{ flex: 1 }}
                      >
                        {busy ? "Saving…" : "Save table"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Row of actions: nudge · edit · delete */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {(
                        [
                          ["◀", -3, 0],
                          ["▲", 0, -3],
                          ["▼", 0, 3],
                          ["▶", 3, 0],
                        ] as const
                      ).map(([glyph, dx, dy], i) => (
                        <button
                          key={i}
                          onClick={() => nudge(selectedTable, dx, dy)}
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
                          aria-label={`Move ${glyph}`}
                        >
                          {glyph}
                        </button>
                      ))}
                      <button
                        onClick={openEditForSelected}
                        className="u-link"
                        style={{ fontSize: 12, marginLeft: 4 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeTable(selectedTable)}
                        className="u-link"
                        style={{ color: "#C0553B", fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>

                    {/* Seated members */}
                    {selectedMembers.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {selectedMembers.map((m) => {
                          const party = m.party_size ?? 1;
                          return (
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
                                {party > 1 && (
                                  <span
                                    style={{
                                      color: T.faint,
                                      marginLeft: 6,
                                      fontSize: 12,
                                    }}
                                  >
                                    · party of {party}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => assignGuest(m.id, null)}
                                className="u-link"
                                style={{ fontSize: 12, color: T.muted2 }}
                              >
                                Unseat
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick: seat entire matching group */}
                    {(() => {
                      const groups = new Set(
                        unassigned
                          .map((g) => g.guest_group)
                          .filter((v): v is string => !!v),
                      );
                      const list = Array.from(groups);
                      if (list.length === 0) return null;
                      return (
                        <div style={{ marginTop: 12 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: T.muted,
                              marginBottom: 6,
                            }}
                          >
                            Seat an entire group here
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {list.map((g) => {
                              const need = seatsUsed(
                                unassigned.filter((u) => u.guest_group === g),
                              );
                              const left =
                                selectedTable.capacity - selectedSeatsUsed;
                              return (
                                <button
                                  key={g}
                                  onClick={() => seatGroupAtSelected(g)}
                                  disabled={busy || need > left}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: need > left ? "not-allowed" : "pointer",
                                    background: need > left ? "#F5EFE9" : "#fff",
                                    border: `1px solid ${T.line3}`,
                                    color: need > left ? T.faint : T.ink,
                                  }}
                                  title={
                                    need > left
                                      ? `Needs ${need} seats · only ${left} left`
                                      : `Seat ${need} guest${need === 1 ? "" : "s"} here`
                                  }
                                >
                                  {g} · {need}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Add-from-unassigned single-guest picker */}
                    {unassigned.length > 0 && !selectedOverCap && (
                      <div style={{ marginTop: 12 }}>
                        <label
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.muted,
                          }}
                          htmlFor="seat-picker"
                        >
                          Seat someone here
                        </label>
                        <select
                          id="seat-picker"
                          value=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (id) assignGuest(id, selectedTable.id);
                          }}
                          style={{
                            marginTop: 4,
                            minHeight: 40,
                            padding: "6px 12px",
                            fontSize: 14,
                          }}
                        >
                          <option value="">Choose a guest…</option>
                          {unassigned.map((g) => {
                            const party = g.party_size ?? 1;
                            return (
                              <option key={g.id} value={g.id}>
                                {g.first_name} {g.last_name ?? ""}
                                {party > 1 ? ` · party of ${party}` : ""}
                                {g.guest_group ? ` · ${g.guest_group}` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </>
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
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="tn">Table name</label>
                    <input
                      id="tn"
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="tc">Seats</label>
                    <input
                      id="tc"
                      type="number"
                      min={1}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {TONE_KEYS.map((k) => {
                      const s = TONE_STYLE[k];
                      const on = newTone === k;
                      return (
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
                            border: `1px solid ${on ? s.ring : T.line3}`,
                            background: on ? s.bg : "#fff",
                            color: T.ink,
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  {!hasHead && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: T.muted,
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newIsHead}
                        onChange={(e) => setNewIsHead(e.target.checked)}
                      />
                      Make this the head / sweetheart table
                    </label>
                  )}
                  {newIsHead && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["rect", "round"] as Shape[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewShape(s)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                            border: `1px solid ${newShape === s ? T.accentBorder : T.line3}`,
                            background: newShape === s ? T.accentSoft : "#fff",
                            color: T.ink,
                          }}
                        >
                          {s === "rect" ? "Rectangle" : "Round"}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button
                      type="submit"
                      disabled={busy || !newName.trim()}
                      style={{ flex: 1 }}
                    >
                      {busy ? "Adding…" : "Add table"}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowNew(false)}>
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

          {/* Unassigned panel — always visible when someone is waiting to be seated */}
          {unassigned.length > 0 && (
            <>
              <SectionLabel>
                {unassigned.length} unassigned · {seatsUsed(unassigned)} seat
                {seatsUsed(unassigned) === 1 ? "" : "s"} to place
              </SectionLabel>
              <Card style={{ padding: 13 }}>
                <input
                  type="search"
                  value={unassignedQuery}
                  onChange={(e) => setUnassignedQuery(e.target.value)}
                  placeholder="Search unassigned…"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 13px",
                    borderRadius: 12,
                    border: `1px solid ${T.line3}`,
                    background: "#fff",
                    fontFamily: T.sans,
                    fontSize: 14,
                    color: T.ink,
                    marginBottom: 10,
                  }}
                />
                {filteredUnassigned.length === 0 ? (
                  <div
                    style={{
                      padding: 8,
                      fontSize: 13,
                      color: T.faint,
                      textAlign: "center",
                    }}
                  >
                    No matches.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {filteredUnassigned.map((g) => {
                      const party = g.party_size ?? 1;
                      return (
                        <div
                          key={g.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 8px",
                            borderRadius: 10,
                            background: "#FFFCFA",
                            border: `1px solid ${T.line}`,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                color: T.ink,
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {g.first_name} {g.last_name ?? ""}
                            </div>
                            <div style={{ fontSize: 11.5, color: T.faint }}>
                              {party > 1 ? `Party of ${party}` : "Party of 1"}
                              {g.guest_group ? ` · ${g.guest_group}` : ""}
                            </div>
                          </div>
                          {(tables ?? []).length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const id = e.target.value;
                                if (id) assignGuest(g.id, id);
                              }}
                              aria-label={`Seat ${g.first_name}`}
                              style={{
                                minHeight: 34,
                                fontSize: 12.5,
                                padding: "4px 6px",
                                borderRadius: 8,
                                border: `1px solid ${T.line3}`,
                                background: "#fff",
                                maxWidth: 140,
                              }}
                            >
                              <option value="">Seat at…</option>
                              {(tables ?? []).map((t) => {
                                const used = seatsUsed(
                                  guestsByTable.get(t.id) ?? [],
                                );
                                const left = t.capacity - used;
                                const room = left >= party;
                                return (
                                  <option
                                    key={t.id}
                                    value={t.id}
                                    disabled={!room}
                                  >
                                    {t.name} ({used}/{t.capacity})
                                    {!room ? " · full" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}

          {(tables?.length ?? 0) === 0 && guests && guests.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <UnionNote>
                <b style={{ color: T.ink }}>{guests.length} guest{guests.length === 1 ? "" : "s"}</b>{" "}
                waiting for a seat. Add a table above to start placing them.
              </UnionNote>
            </div>
          )}
        </>
      ) : (
        // Ceremony view
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
                  textAlign: "center",
                  maxWidth: 132,
                  overflow: "hidden",
                }}
                title={wedding.venue_name ?? "The arch"}
              >
                {(wedding.venue_name ?? "The arch").length > 14
                  ? "The arch"
                  : wedding.venue_name ?? "The arch"}
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
                {Array.from({ length: ceremony.rows }).map((_, r) => (
                  <div key={r} style={{ display: "flex", gap: 26 }}>
                    {(["left", "right"] as const).map((side) => {
                      const isReserved = r < ceremony.reserved;
                      const members = ceremonyByPew.get(`${r}:${side}`) ?? [];
                      const people = seatsUsed(members);
                      const isOn =
                        selectedPew?.row === r && selectedPew.side === side;
                      return (
                        <button
                          key={side}
                          onClick={() => setSelectedPew({ row: r, side })}
                          aria-label={`Row ${r + 1} · ${
                            side === "left"
                              ? wedding.partner_one ?? "Partner"
                              : wedding.partner_two ?? "Partner"
                          }'s side`}
                          style={{
                            flex: 1,
                            minHeight: isReserved ? 26 : 22,
                            borderRadius: isReserved ? 6 : 5,
                            background: isReserved ? T.accentSoft : "#EBE1D8",
                            border: isReserved
                              ? `1px solid ${T.accentBorder}`
                              : "1px solid rgba(67,53,58,.08)",
                            outline: isOn ? `2px solid ${T.ink}` : "none",
                            outlineOffset: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            padding: "3px 6px",
                            fontWeight: 600,
                            fontSize: 9,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: isReserved ? T.accentInk : T.muted2,
                            cursor: "pointer",
                            fontFamily: T.sans,
                            overflow: "hidden",
                          }}
                          title={
                            members.length > 0
                              ? members
                                  .map(
                                    (m) => `${m.first_name} ${m.last_name ?? ""}`.trim(),
                                  )
                                  .join(", ")
                              : isReserved
                                ? "Reserved"
                                : "Empty"
                          }
                        >
                          {members.length === 0 ? (
                            <span style={{ opacity: isReserved ? 1 : 0.5 }}>
                              {isReserved ? "Reserved" : ""}
                            </span>
                          ) : (
                            <>
                              {members.slice(0, 3).map((m) => (
                                <span
                                  key={m.id}
                                  style={{
                                    fontFamily: T.serif,
                                    fontWeight: 700,
                                    fontSize: 11,
                                    lineHeight: 1,
                                    padding: "2px 5px",
                                    borderRadius: 999,
                                    background: "#fff",
                                    color: T.ink,
                                    border: `1px solid ${T.line3}`,
                                    letterSpacing: 0,
                                  }}
                                >
                                  {initial(m.first_name)}
                                </span>
                              ))}
                              {members.length > 3 && (
                                <span
                                  style={{
                                    fontFamily: T.sans,
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: T.muted2,
                                  }}
                                >
                                  +{members.length - 3}
                                </span>
                              )}
                              {people > members.length && (
                                <span
                                  style={{
                                    fontFamily: T.sans,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    color: T.faint,
                                    letterSpacing: 0,
                                  }}
                                >
                                  ({people})
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Selected pew — assign / unassign guests */}
          {selectedPew && (
            <div style={{ marginTop: 14 }}>
              <Card style={{ padding: 15 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="u-serif"
                      style={{ fontWeight: 600, fontSize: 20, color: T.ink }}
                    >
                      Row {selectedPew.row + 1}
                      {selectedPew.row < ceremony.reserved && (
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: T.accentSoft,
                            color: T.accentInk,
                            border: `1px solid ${T.accentBorder}`,
                            marginLeft: 8,
                            verticalAlign: "middle",
                          }}
                        >
                          Reserved
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                      {selectedPew.side === "left"
                        ? wedding.partner_one ?? "Partner"
                        : wedding.partner_two ?? "Partner"}
                      &apos;s side ·{" "}
                      {seatsUsed(selectedPewMembers)}{" "}
                      seat{seatsUsed(selectedPewMembers) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPew(null)}
                    className="u-link"
                    style={{ fontSize: 13 }}
                    aria-label="Close selected pew"
                  >
                    Close
                  </button>
                </div>

                {selectedPewMembers.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {selectedPewMembers.map((m) => {
                      const party = m.party_size ?? 1;
                      return (
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
                            {party > 1 && (
                              <span
                                style={{
                                  color: T.faint,
                                  marginLeft: 6,
                                  fontSize: 12,
                                }}
                              >
                                · party of {party}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => assignPew(m.id, null, null)}
                            className="u-link"
                            style={{ fontSize: 12, color: T.muted2 }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(guests ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.muted,
                      }}
                      htmlFor="pew-picker"
                    >
                      Add a guest
                    </label>
                    <select
                      id="pew-picker"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) assignPew(id, selectedPew.row, selectedPew.side);
                      }}
                      style={{
                        marginTop: 4,
                        minHeight: 40,
                        padding: "6px 12px",
                        fontSize: 14,
                      }}
                    >
                      <option value="">Choose a guest…</option>
                      {(guests ?? [])
                        .filter(
                          (g) =>
                            !(
                              g.ceremony_row === selectedPew.row &&
                              g.ceremony_side === selectedPew.side
                            ),
                        )
                        .map((g) => {
                          const party = g.party_size ?? 1;
                          const currentlyIn =
                            g.ceremony_row != null && g.ceremony_side != null;
                          return (
                            <option key={g.id} value={g.id}>
                              {g.first_name} {g.last_name ?? ""}
                              {party > 1 ? ` · party of ${party}` : ""}
                              {g.guest_group ? ` · ${g.guest_group}` : ""}
                              {currentlyIn
                                ? ` · in row ${(g.ceremony_row ?? 0) + 1}`
                                : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </Card>
            </div>
          )}

          {ceremonyOffPlan.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <UnionNote
                action={
                  <Button
                    variant="secondary"
                    onClick={() =>
                      saveCeremony({
                        rows: Math.max(
                          ...ceremonyOffPlan.map((g) => (g.ceremony_row ?? 0) + 1),
                          ceremony.rows,
                        ),
                        reserved: ceremony.reserved,
                      })
                    }
                    style={{
                      minHeight: 36,
                      fontSize: 12.5,
                      padding: "0 12px",
                    }}
                  >
                    Grow layout
                  </Button>
                }
              >
                <b style={{ color: T.ink }}>
                  {ceremonyOffPlan.length} guest
                  {ceremonyOffPlan.length === 1 ? "" : "s"}
                </b>{" "}
                sit past the last visible row. Grow the layout to see them.
              </UnionNote>
            </div>
          )}

          {/* Ceremony controls */}
          <Card style={{ marginTop: 13, padding: 13 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.muted,
                marginBottom: 8,
              }}
            >
              Layout
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stepper
                label="Rows"
                value={ceremony.rows}
                min={2}
                max={24}
                onChange={(rows) =>
                  saveCeremony({
                    rows,
                    reserved: Math.min(ceremony.reserved, rows),
                  })
                }
              />
              <Stepper
                label="Reserved"
                value={ceremony.reserved}
                min={0}
                max={ceremony.rows}
                onChange={(reserved) => saveCeremony({ ...ceremony, reserved })}
              />
            </div>
          </Card>

          <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
            <StatTile
              value={(guests ?? []).reduce((s, g) => s + (g.party_size ?? 1), 0)}
              label="seats needed"
            />
            <StatTile
              value={ceremonyAssignedCount}
              label="in a pew"
            />
            <StatTile value={totalSeatsUsed} label="at a table" />
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

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px 6px 12px",
        borderRadius: 12,
        border: `1px solid ${T.line3}`,
        background: "#fff",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        style={{
          width: 28,
          height: 28,
          border: `1px solid ${T.line3}`,
          borderRadius: 8,
          background: "#fff",
          cursor: value <= min ? "not-allowed" : "pointer",
          color: T.muted,
          opacity: value <= min ? 0.4 : 1,
        }}
      >
        −
      </button>
      <div
        className="u-serif"
        style={{
          minWidth: 20,
          textAlign: "center",
          fontWeight: 700,
          fontSize: 16,
          color: T.ink,
        }}
      >
        {value}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        style={{
          width: 28,
          height: 28,
          border: `1px solid ${T.line3}`,
          borderRadius: 8,
          background: "#fff",
          cursor: value >= max ? "not-allowed" : "pointer",
          color: T.muted,
          opacity: value >= max ? 0.4 : 1,
        }}
      >
        +
      </button>
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
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
        {value}
      </div>
      <div
        style={{
          fontWeight: 500,
          fontSize: 11.5,
          color: T.faint,
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </Card>
  );
}
