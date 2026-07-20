"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import type { GuestGroup } from "@union/shared";
import {
  addGuestGroup,
  addGuestToGroup,
  deleteGuestGroup,
  fetchGuestGroups,
  fetchGuests,
  removeGuestFromGroup,
  renameGuestGroup,
  updateGuest,
  updateGuestGroup,
  type GuestWithRsvp,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import {
  Card,
  SectionLabel,
  Avatar,
  Button,
  Loading,
  StatusPill,
  Chip,
} from "@/components/ui";

const PALETTE = [
  { bg: "#F2E1E0", ring: "#C79BA0", name: "Rosewood" },
  { bg: "#E7EFE6", ring: "#A9C0AC", name: "Sage" },
  { bg: "#FBEEE2", ring: "#DDB27C", name: "Amber" },
  { bg: "#E4E7EE", ring: "#A6ACC0", name: "Slate" },
  { bg: "#EEDCDF", ring: "#C79BA0", name: "Blush" },
  { bg: "#EFE7DF", ring: "#C1B4AD", name: "Sand" },
] as const;

const STARTERS = ["Family", "Friends", "Colleagues", "Plus ones"] as const;

const SUGGESTED_ROLES = [
  "Maid of honor",
  "Best man",
  "Bridesmaid",
  "Groomsman",
  "Officiant",
  "Ring bearer",
  "Flower girl",
  "Witness",
] as const;

function paletteFor(color: string | null | undefined) {
  if (!color) return PALETTE[0];
  return PALETTE.find((p) => p.bg === color) ?? PALETTE[0];
}

type RsvpBreakdown = { attending: number; declined: number; pending: number };

function breakdownFor(members: GuestWithRsvp[]): RsvpBreakdown {
  const out: RsvpBreakdown = { attending: 0, declined: 0, pending: 0 };
  for (const m of members) {
    const s = m.rsvps?.status ?? "pending";
    if (s === "attending") out.attending += 1;
    else if (s === "declined") out.declined += 1;
    else out.pending += 1;
  }
  return out;
}

export default function GroupsPage() {
  const { wedding } = useWedding();
  const [groups, setGroups] = useState<GuestGroup[] | null>(null);
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(PALETTE[0].bg);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  // Role administration state (kept local — nothing goes to the URL).
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState("");
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [assignRoleGuestId, setAssignRoleGuestId] = useState<string>("");
  const [assignRoleValue, setAssignRoleValue] = useState<string>("");

  const reload = async () => {
    if (!wedding) return;
    const [gs, gg] = await Promise.all([
      fetchGuestGroups(wedding.id),
      fetchGuests(wedding.id),
    ]);
    setGroups(gs);
    setGuests(gg);
  };

  useEffect(() => {
    reload().catch((err) => {
      setError(err instanceof Error ? err.message : "Couldn't load groups.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedding?.id]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  // -------- membership derivations --------

  /** Members of a group: any guest whose .groups includes this group id or name. */
  const membersOf = (g: GuestGroup): GuestWithRsvp[] => {
    return (guests ?? []).filter((x) =>
      x.groups?.some((r) => r.id === g.id || r.name === g.name),
    );
  };

  const perGroup = useMemo(() => {
    const map = new Map<string, GuestWithRsvp[]>();
    for (const g of groups ?? []) map.set(g.id, membersOf(g));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, guests]);

  const roles = useMemo(
    () => (guests ?? []).filter((g) => !!g.role?.trim()),
    [guests],
  );

  const ungrouped = useMemo(
    () => (guests ?? []).filter((g) => (g.groups?.length ?? 0) === 0),
    [guests],
  );

  const filteredMembers = (list: GuestWithRsvp[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((g) =>
      `${g.first_name ?? ""} ${g.last_name ?? ""} ${g.email ?? ""} ${g.role ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  };

  if (!wedding) return null;

  // -------- actions --------

  const nameExists = (name: string, ignoreId?: string) => {
    const n = name.trim().toLowerCase();
    return (groups ?? []).some(
      (g) => g.name.toLowerCase() === n && g.id !== ignoreId,
    );
  };

  const addGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (nameExists(name)) {
      setError(`"${name}" already exists — pick another name.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addGuestGroup({
        wedding_id: wedding.id,
        name,
        color: newColor,
        sort_order: (groups?.length ?? 0) + 1,
      });
      setNewName("");
      setShowAdd(false);
      setFlash(`Added "${name}".`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add group.");
    } finally {
      setBusy(false);
    }
  };

  const addStarter = async (name: string) => {
    if (nameExists(name)) return;
    setBusy(true);
    setError(null);
    try {
      const color = PALETTE[(groups?.length ?? 0) % PALETTE.length].bg;
      await addGuestGroup({
        wedding_id: wedding.id,
        name,
        color,
        sort_order: (groups?.length ?? 0) + 1,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add group.");
    } finally {
      setBusy(false);
    }
  };

  const changeColor = async (g: GuestGroup, color: string) => {
    setGroups(
      (prev) => prev?.map((x) => (x.id === g.id ? { ...x, color } : x)) ?? prev,
    );
    try {
      await updateGuestGroup(g.id, { color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't recolor.");
      await reload();
    }
  };

  const commitRename = async (g: GuestGroup) => {
    const to = editingName.trim();
    if (!to || to === g.name) {
      setEditingId(null);
      return;
    }
    if (nameExists(to, g.id)) {
      setError(`"${to}" already exists — pick another name.`);
      return;
    }
    try {
      await renameGuestGroup(g.id, wedding.id, g.name, to);
      setEditingId(null);
      setFlash(`Renamed to "${to}".`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rename.");
    }
  };

  const removeGroup = async (g: GuestGroup) => {
    const n = (perGroup.get(g.id) ?? []).length;
    try {
      await deleteGuestGroup(g.id, wedding.id, g.name);
      setConfirmDeleteId(null);
      setFlash(
        `Deleted "${g.name}"${
          n > 0 ? ` · ${n} guest${n === 1 ? "" : "s"} released` : ""
        }.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove.");
    }
  };

  const reorder = async (g: GuestGroup, direction: -1 | 1) => {
    const list = groups ?? [];
    const idx = list.findIndex((x) => x.id === g.id);
    if (idx < 0) return;
    const swap = idx + direction;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx];
    const b = list[swap];
    const nextList = [...list];
    nextList[idx] = b;
    nextList[swap] = a;
    setGroups(nextList);
    try {
      await Promise.all([
        updateGuestGroup(a.id, { sort_order: swap + 1 }),
        updateGuestGroup(b.id, { sort_order: idx + 1 }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reorder.");
      await reload();
    }
  };

  /**
   * Toggle membership: add if not a member, remove if already a member.
   * Optimistic UI patch, then persist.
   */
  const toggleMembership = async (
    guest: GuestWithRsvp,
    group: GuestGroup,
  ) => {
    const isMember = guest.groups?.some(
      (r) => r.id === group.id || r.name === group.name,
    );
    setGuests((prev) =>
      prev
        ? prev.map((x) => {
            if (x.id !== guest.id) return x;
            const nextGroups = isMember
              ? (x.groups ?? []).filter(
                  (r) => r.id !== group.id && r.name !== group.name,
                )
              : [
                  ...(x.groups ?? []),
                  { id: group.id, name: group.name, color: group.color },
                ];
            return { ...x, groups: nextGroups };
          })
        : prev,
    );
    try {
      if (isMember) {
        await removeGuestFromGroup(guest.id, { id: group.id, name: group.name });
        setFlash(`Removed ${guest.first_name} from ${group.name}.`);
      } else {
        await addGuestToGroup(guest.id, { id: group.id, name: group.name });
        setFlash(`Added ${guest.first_name} to ${group.name}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update groups.");
      await reload();
    }
  };

  const assignRole = async (guestId: string, nextRole: string | null) => {
    const trimmed = nextRole?.trim() || null;
    // Optimistic — the roles list re-derives from guests.
    setGuests((prev) =>
      prev
        ? prev.map((x) => (x.id === guestId ? { ...x, role: trimmed } : x))
        : prev,
    );
    try {
      await updateGuest(guestId, { role: trimmed });
      setFlash(trimmed ? `Role set to ${trimmed}.` : "Role cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save role.");
      await reload();
    }
  };

  const submitAssignRole = async () => {
    const gid = assignRoleGuestId;
    const role = assignRoleValue.trim();
    if (!gid || !role) return;
    await assignRole(gid, role);
    setAssignRoleGuestId("");
    setAssignRoleValue("");
    setAssignRoleOpen(false);
  };

  const loading = groups === null || guests === null;
  const totalGuests = guests?.length ?? 0;
  const totalGroups = (groups ?? []).length;

  return (
    <main className="u-main">
      <BackHeader
        title="Groups & roles"
        subtitle={
          guests
            ? `${totalGuests} guest${totalGuests === 1 ? "" : "s"} · ${totalGroups} group${totalGroups === 1 ? "" : "s"}`
            : "Loading…"
        }
        fallback="/guests"
      />

      {flash && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: T.greenBg,
            color: T.greenInk,
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 12,
            border: `1px solid rgba(126,154,130,.3)`,
          }}
        >
          {flash}
        </div>
      )}

      <SectionLabel style={{ marginTop: 8 }}>Groups</SectionLabel>
      <div
        style={{
          fontSize: 12,
          color: T.faint,
          padding: "0 4px 8px",
          lineHeight: 1.4,
        }}
      >
        A guest can belong to more than one — great for mixed-family plus-ones
        or friends who are also witnesses.
      </div>

      {loading ? (
        <Loading label="Loading groups…" />
      ) : totalGroups === 0 ? (
        <Card soft style={{ padding: 20 }}>
          <div
            className="u-serif"
            style={{ fontSize: 22, color: T.ink, fontWeight: 600, lineHeight: 1.1 }}
          >
            No groups yet
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: T.muted,
              marginTop: 8,
              lineHeight: 1.45,
            }}
          >
            Groups colour-code your list — family, close friends, the office —
            so you can see who&apos;s coming at a glance.
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="u-kicker" style={{ marginBottom: 8 }} aria-hidden>
              Quick start
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addStarter(s)}
                  disabled={busy || nameExists(s)}
                  style={{
                    minHeight: 34,
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1px solid ${T.line3}`,
                    background: "#fff",
                    color: T.ink,
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: nameExists(s) ? "default" : "pointer",
                    opacity: nameExists(s) ? 0.4 : 1,
                  }}
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Button
              onClick={() => setShowAdd(true)}
              style={{ minHeight: 40, fontSize: 13.5 }}
            >
              Create a group
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {(groups ?? []).map((g, idx) => {
              const p = paletteFor(g.color);
              const members = perGroup.get(g.id) ?? [];
              const count = members.length;
              const bd = breakdownFor(members);
              const isEditing = editingId === g.id;
              const isConfirming = confirmDeleteId === g.id;
              const isExpanded = expandedId === g.id;
              const isFirst = idx === 0;
              const isLast = idx === (groups ?? []).length - 1;

              return (
                <Card key={g.id} style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: p.bg,
                        border: `1.5px solid ${p.ring}`,
                      }}
                    />
                    <span
                      className="u-serif"
                      style={{
                        fontWeight: 600,
                        fontSize: 24,
                        color: T.ink,
                        lineHeight: 1,
                      }}
                    >
                      {count}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        gap: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => reorder(g, -1)}
                        disabled={isFirst}
                        aria-label={`Move ${g.name} up`}
                        title="Move up"
                        style={ghostBtn(isFirst)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(g, 1)}
                        disabled={isLast}
                        aria-label={`Move ${g.name} down`}
                        title="Move down"
                        style={ghostBtn(isLast)}
                      >
                        ↓
                      </button>
                    </span>
                  </div>

                  {isEditing ? (
                    <div style={{ marginTop: 9 }}>
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(g);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        aria-label={`Rename ${g.name}`}
                        style={{
                          width: "100%",
                          minHeight: 32,
                          padding: "6px 10px",
                          fontSize: 13.5,
                          borderRadius: 8,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => commitRename(g)}
                          className="u-link"
                          style={{ fontSize: 12 }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="u-link"
                          style={{ fontSize: 12, color: T.muted }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(g.id);
                        setEditingName(g.name);
                      }}
                      aria-label={`Rename ${g.name}`}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: T.ink,
                        marginTop: 9,
                        cursor: "text",
                        background: "none",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      {g.name}
                    </button>
                  )}

                  {count > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                        fontSize: 11,
                        color: T.muted,
                      }}
                      aria-label={`${bd.attending} attending, ${bd.pending} awaiting, ${bd.declined} declined`}
                    >
                      <BreakdownDot color={T.green} label={String(bd.attending)} />
                      <BreakdownDot color={T.amber} label={String(bd.pending)} />
                      <BreakdownDot color={T.sand} label={String(bd.declined)} />
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {PALETTE.map((p2) => (
                      <button
                        key={p2.bg}
                        aria-label={`Colour ${p2.name}`}
                        title={p2.name}
                        onClick={() => changeColor(g, p2.bg)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: p2.bg,
                          border: `1.5px solid ${p2.ring}`,
                          outline:
                            g.color === p2.bg ? `2px solid ${T.ink}` : "none",
                          outlineOffset: 1,
                          padding: 0,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>

                  {isConfirming ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: "#F7E6E1",
                        color: "#C0553B",
                        fontSize: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      Delete <b>{g.name}</b>?
                      {count > 0
                        ? ` ${count} guest${count === 1 ? "" : "s"} will lose this label.`
                        : ""}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => removeGroup(g)}
                          style={{
                            background: "#C0553B",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 12,
                            padding: "6px 12px",
                            borderRadius: 20,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="u-link"
                          style={{ color: T.muted, fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : g.id)
                        }
                        className="u-link"
                        style={{ fontSize: 12, color: T.muted }}
                      >
                        {isExpanded ? "Hide members" : "Show members"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(g.id)}
                        className="u-link"
                        style={{ color: "#C0553B", fontSize: 12 }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {isExpanded && count > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        borderTop: `1px solid ${T.line}`,
                        paddingTop: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {members.map((m) => (
                        <Link
                          key={m.id}
                          href={`/guests/${m.id}`}
                          style={{
                            fontSize: 12.5,
                            color: T.ink,
                            fontWeight: 500,
                            padding: "4px 0",
                            textDecoration: "none",
                          }}
                        >
                          {m.first_name} {m.last_name ?? ""}
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Add-group tile */}
            <Card
              soft
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {showAdd ? (
                <form
                  onSubmit={addGroup}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13.5,
                      color: T.muted,
                    }}
                  >
                    New group
                  </div>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name it…"
                    aria-label="Group name"
                    style={{
                      minHeight: 36,
                      padding: "6px 10px",
                      fontSize: 13,
                    }}
                  />
                  <div
                    style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                    role="radiogroup"
                    aria-label="Group colour"
                  >
                    {PALETTE.map((p) => (
                      <button
                        key={p.bg}
                        type="button"
                        onClick={() => setNewColor(p.bg)}
                        aria-label={`Colour ${p.name}`}
                        aria-checked={newColor === p.bg}
                        role="radio"
                        title={p.name}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: p.bg,
                          border: `1.5px solid ${p.ring}`,
                          outline:
                            newColor === p.bg ? `2px solid ${T.ink}` : "none",
                          outlineOffset: 1,
                          padding: 0,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      type="submit"
                      disabled={busy || !newName.trim()}
                      style={{ minHeight: 38, fontSize: 13, flex: 1 }}
                    >
                      {busy ? "Adding…" : "Add"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdd(false);
                        setNewName("");
                        setError(null);
                      }}
                      className="u-link"
                      style={{ fontSize: 12, color: T.muted }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13.5,
                      color: T.muted,
                    }}
                  >
                    + New group
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: T.faint,
                      marginTop: 4,
                    }}
                  >
                    Name it and pick a colour
                  </div>
                </button>
              )}
            </Card>
          </div>
        </>
      )}

      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {/* ---------------- Ungrouped ---------------- */}
      {!loading && ungrouped.length > 0 && (
        <>
          <SectionLabel>Ungrouped ({ungrouped.length})</SectionLabel>
          <Card style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 12.5,
                color: T.muted,
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              Give each guest at least one group so seating and communications
              stay organised.
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {ungrouped.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 6px",
                    borderTop: `1px solid ${T.line}`,
                  }}
                >
                  <Avatar
                    letter={(m.first_name || "?").charAt(0).toUpperCase()}
                    tint="sand"
                    size={30}
                  />
                  <Link
                    href={`/guests/${m.id}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textDecoration: "none",
                      color: T.ink,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.first_name} {m.last_name ?? ""}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.faint }}>
                      Party of {m.party_size ?? 1}
                    </div>
                  </Link>
                  {(groups ?? []).length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        const targetId = e.target.value;
                        if (!targetId) return;
                        const target = (groups ?? []).find(
                          (g) => g.id === targetId,
                        );
                        if (target) void toggleMembership(m, target);
                      }}
                      aria-label={`Assign ${m.first_name} to a group`}
                      style={{
                        minHeight: 32,
                        borderRadius: 8,
                        border: `1px solid ${T.line3}`,
                        background: "#fff",
                        color: T.ink,
                        fontSize: 12.5,
                        padding: "0 8px",
                      }}
                    >
                      <option value="" disabled>
                        Assign…
                      </option>
                      {(groups ?? []).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 11.5, color: T.faint }}>
                      Create a group first
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ---------------- Members section ---------------- */}
      {!loading && totalGroups > 0 && totalGuests > 0 && (
        <>
          <SectionLabel>Who&apos;s in each group</SectionLabel>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            aria-label="Search guests"
            style={{
              width: "100%",
              minHeight: 40,
              padding: "8px 12px",
              fontSize: 13.5,
              borderRadius: 12,
              border: `1px solid ${T.line3}`,
              background: "#fff",
              marginBottom: 12,
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(groups ?? []).map((g) => {
              const p = paletteFor(g.color);
              const raw = perGroup.get(g.id) ?? [];
              const members = filteredMembers(raw);
              const bd = breakdownFor(raw);

              if (query && members.length === 0) return null;

              return (
                <div key={g.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 4px 8px",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: p.bg,
                        border: `1.5px solid ${p.ring}`,
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: T.ink,
                      }}
                    >
                      {g.name}
                    </span>
                    <span style={{ fontSize: 12, color: T.faint }}>
                      {members.length}
                      {query && members.length !== raw.length
                        ? ` of ${raw.length}`
                        : ""}
                    </span>
                    {raw.length > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          gap: 8,
                          fontSize: 11,
                          color: T.muted,
                        }}
                      >
                        <BreakdownDot color={T.green} label={String(bd.attending)} />
                        <BreakdownDot color={T.amber} label={String(bd.pending)} />
                        <BreakdownDot color={T.sand} label={String(bd.declined)} />
                      </span>
                    )}
                  </div>

                  {members.length === 0 ? (
                    <Card soft style={{ padding: 14 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: T.muted,
                          textAlign: "center",
                        }}
                      >
                        No one in this group yet.{" "}
                        <Link href="/guests/new" style={{ color: T.accentInk }}>
                          Add a guest
                        </Link>
                        .
                      </div>
                    </Card>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {members.map((m) => (
                        <MemberRow
                          key={m.id}
                          m={m}
                          currentGroupId={g.id}
                          groups={groups ?? []}
                          onToggle={toggleMembership}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- Roles ---------------- */}
      <SectionLabel>Wedding-party roles</SectionLabel>
      {loading ? null : totalGuests === 0 ? (
        <Card soft style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, color: T.muted }}>
            Add guests first, then give the wedding party their roles here.
          </div>
        </Card>
      ) : (
        <>
          {roles.length === 0 ? (
            <Card style={{ padding: 16, marginBottom: 10 }}>
              <div
                style={{ fontSize: 13.5, color: T.muted, marginBottom: 10 }}
              >
                No roles assigned yet — pick a guest and give them a role.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTED_ROLES.slice(0, 6).map((r) => (
                  <Chip key={r} style={{ fontWeight: 500, opacity: 0.7 }}>
                    {r}
                  </Chip>
                ))}
              </div>
            </Card>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 10,
              }}
            >
              {roles.map((r) => {
                const isEditing = editingRoleFor === r.id;
                return (
                  <Card
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 15px",
                    }}
                  >
                    <Avatar
                      letter={(r.first_name || "?").charAt(0).toUpperCase()}
                      tint="green"
                      size={36}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/guests/${r.id}`}
                        style={{ textDecoration: "none", color: T.ink }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {r.first_name} {r.last_name ?? ""}
                        </div>
                      </Link>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.faint,
                          marginTop: 1,
                        }}
                      >
                        {r.groups && r.groups.length > 0
                          ? r.groups.map((x) => x.name).join(" · ")
                          : "Ungrouped"}
                      </div>
                    </div>

                    {isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <input
                          autoFocus
                          list="role-suggestions"
                          value={roleDraft}
                          onChange={(e) => setRoleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              assignRole(r.id, roleDraft);
                              setEditingRoleFor(null);
                            } else if (e.key === "Escape") {
                              setEditingRoleFor(null);
                            }
                          }}
                          aria-label={`Edit role for ${r.first_name}`}
                          style={{
                            minHeight: 32,
                            padding: "4px 8px",
                            fontSize: 12.5,
                            borderRadius: 8,
                            border: `1px solid ${T.line3}`,
                            width: 140,
                          }}
                        />
                        <button
                          type="button"
                          className="u-link"
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            assignRole(r.id, roleDraft);
                            setEditingRoleFor(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoleFor(r.id);
                          setRoleDraft(r.role ?? "");
                        }}
                        aria-label={`Change ${r.first_name}'s role`}
                        style={{
                          background: T.blueBg,
                          color: T.blueInk,
                          fontWeight: 600,
                          fontSize: 11,
                          padding: "5px 11px",
                          borderRadius: 20,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {r.role}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => assignRole(r.id, null)}
                      aria-label={`Clear ${r.first_name}'s role`}
                      title="Clear role"
                      style={{
                        background: "none",
                        border: "none",
                        color: T.faint,
                        fontSize: 16,
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                    >
                      ×
                    </button>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Assign-role admin panel */}
          <Card soft style={{ padding: 12 }}>
            {assignRoleOpen ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: T.ink,
                  }}
                >
                  Assign a role
                </div>
                <select
                  value={assignRoleGuestId}
                  onChange={(e) => setAssignRoleGuestId(e.target.value)}
                  aria-label="Choose a guest"
                  style={{
                    minHeight: 36,
                    borderRadius: 10,
                    border: `1px solid ${T.line3}`,
                    background: "#fff",
                    color: T.ink,
                    fontSize: 13,
                    padding: "0 8px",
                  }}
                >
                  <option value="" disabled>
                    Choose a guest…
                  </option>
                  {(guests ?? [])
                    .slice()
                    .sort((a, b) =>
                      (a.first_name ?? "").localeCompare(b.first_name ?? ""),
                    )
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.first_name} {g.last_name ?? ""}
                        {g.role ? ` — ${g.role}` : ""}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  list="role-suggestions"
                  value={assignRoleValue}
                  onChange={(e) => setAssignRoleValue(e.target.value)}
                  placeholder="Role (e.g., Maid of honor)"
                  aria-label="Role"
                  style={{
                    minHeight: 36,
                    padding: "6px 10px",
                    fontSize: 13,
                    borderRadius: 10,
                    border: `1px solid ${T.line3}`,
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SUGGESTED_ROLES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAssignRoleValue(s)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 20,
                        border: `1px solid ${T.line3}`,
                        background:
                          assignRoleValue === s ? T.accentSoft : "#fff",
                        color: T.muted,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Button
                    type="button"
                    onClick={submitAssignRole}
                    disabled={!assignRoleGuestId || !assignRoleValue.trim()}
                    style={{ minHeight: 38, fontSize: 13, flex: 1 }}
                  >
                    Assign role
                  </Button>
                  <button
                    type="button"
                    className="u-link"
                    style={{ color: T.muted, fontSize: 12 }}
                    onClick={() => {
                      setAssignRoleOpen(false);
                      setAssignRoleGuestId("");
                      setAssignRoleValue("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAssignRoleOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13.5, color: T.muted }}>
                  + Assign a role
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
                  Pick a guest and give them a role — Maid of honor, Best
                  man, Officiant…
                </div>
              </button>
            )}
          </Card>

          {/* Shared datalist for role autocompletion */}
          <datalist id="role-suggestions">
            {SUGGESTED_ROLES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      )}
    </main>
  );
}

// ---------------- helpers ----------------

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: `1px solid ${T.line3}`,
    background: "#fff",
    color: disabled ? T.faint : T.ink,
    fontSize: 12,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    padding: 0,
    lineHeight: 1,
  };
}

function BreakdownDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

/**
 * A member row. Shows all the guest's groups as coloured chips and opens
 * a picker where you can toggle any group on or off.
 */
function MemberRow({
  m,
  currentGroupId,
  groups,
  onToggle,
}: {
  m: GuestWithRsvp;
  currentGroupId: string;
  groups: GuestGroup[];
  onToggle: (guest: GuestWithRsvp, group: GuestGroup) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = m.rsvps?.status ?? "pending";
  const statusTone: "green" | "amber" | "sand" =
    status === "attending" ? "green" : status === "declined" ? "sand" : "amber";
  const statusLabel =
    status === "attending"
      ? "Attending"
      : status === "declined"
        ? "Can't make it"
        : "Awaiting";
  const memberOfIds = new Set(m.groups?.map((r) => r.id) ?? []);
  const memberOfNames = new Set(m.groups?.map((r) => r.name) ?? []);
  const otherGroups = m.groups?.filter((r) => r.id !== currentGroupId) ?? [];

  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 15px",
        position: "relative",
      }}
    >
      <Link
        href={`/guests/${m.id}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          color: T.ink,
        }}
      >
        <Avatar
          letter={(m.first_name || "?").charAt(0).toUpperCase()}
          tint="accent"
          size={30}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.first_name} {m.last_name ?? ""}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: T.faint,
              marginTop: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>Party of {m.party_size ?? 1}</span>
            {m.role ? <span>· {m.role}</span> : null}
            {otherGroups.length > 0 && (
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: T.faint }}>·</span>
                {otherGroups.map((r) => {
                  const p = PALETTE.find((c) => c.bg === r.color) ?? PALETTE[0];
                  return (
                    <span
                      key={r.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        color: T.muted,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: p.bg,
                          border: `1px solid ${p.ring}`,
                        }}
                      />
                      {r.name}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        </div>
      </Link>
      <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={`Edit ${m.first_name}'s groups`}
        aria-expanded={menuOpen}
        title="Edit groups"
        style={{
          background: "none",
          border: "none",
          color: T.muted,
          fontSize: 18,
          cursor: "pointer",
          padding: "0 4px",
          lineHeight: 1,
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <>
          {/* click-outside overlay */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 3,
            }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "100%",
              right: 12,
              marginTop: 4,
              background: "#fff",
              border: `1px solid ${T.line3}`,
              borderRadius: 12,
              boxShadow: "0 12px 24px rgba(67,53,58,.12)",
              zIndex: 4,
              minWidth: 200,
              padding: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: T.faint,
                padding: "6px 10px 4px",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Groups
            </div>
            {groups.map((g) => {
              const isMember =
                memberOfIds.has(g.id) || memberOfNames.has(g.name);
              const p = paletteFor(g.color);
              return (
                <button
                  key={g.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isMember}
                  onClick={() => onToggle(m, g)}
                  style={menuItemStyle()}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      border: `1.5px solid ${isMember ? T.ink : T.line3}`,
                      background: isMember ? T.ink : "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    {isMember ? "✓" : ""}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: p.bg,
                      border: `1.5px solid ${p.ring}`,
                    }}
                  />
                  <span style={{ flex: 1 }}>{g.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 8,
    background: "none",
    border: "none",
    fontSize: 13,
    color: T.ink,
    cursor: "pointer",
  };
}
