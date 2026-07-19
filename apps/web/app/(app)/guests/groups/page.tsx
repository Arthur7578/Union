"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import type { GuestGroup } from "@union/shared";
import {
  addGuestGroup,
  deleteGuestGroup,
  fetchGuestGroups,
  fetchGuests,
  renameGuestGroup,
  updateGuestGroup,
  type GuestWithRsvp,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, SectionLabel, Avatar, Button, Loading } from "@/components/ui";

const PALETTE = [
  { bg: "#F2E1E0", ring: "#C79BA0" },
  { bg: "#E7EFE6", ring: "#A9C0AC" },
  { bg: "#FBEEE2", ring: "#DDB27C" },
  { bg: "#E4E7EE", ring: "#A6ACC0" },
  { bg: "#EEDCDF", ring: "#C79BA0" },
  { bg: "#EFE7DF", ring: "#C1B4AD" },
] as const;

function paletteFor(color: string | null | undefined) {
  if (!color) return PALETTE[0];
  const hit = PALETTE.find((p) => p.bg === color);
  return hit ?? PALETTE[0];
}

export default function GroupsPage() {
  const { wedding } = useWedding();
  const [groups, setGroups] = useState<GuestGroup[] | null>(null);
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(PALETTE[0].bg);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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

  const perGroup = useMemo(() => {
    const map = new Map<string, GuestWithRsvp[]>();
    for (const g of guests ?? []) {
      const key = g.guest_group ?? "";
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(g);
      map.set(key, list);
    }
    return map;
  }, [guests]);

  const roles = useMemo(
    () => (guests ?? []).filter((g) => !!g.role?.trim()),
    [guests],
  );

  const ungroupedCount = useMemo(
    () => (guests ?? []).filter((g) => !g.guest_group).length,
    [guests],
  );

  if (!wedding) return null;

  const addGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add group.");
    } finally {
      setBusy(false);
    }
  };

  const changeColor = async (g: GuestGroup, color: string) => {
    await updateGuestGroup(g.id, { color });
    await reload();
  };

  const commitRename = async (g: GuestGroup) => {
    const to = editingName.trim();
    if (!to || to === g.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameGuestGroup(g.id, wedding.id, g.name, to);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rename.");
    }
  };

  const removeGroup = async (g: GuestGroup) => {
    const n = perGroup.get(g.name)?.length ?? 0;
    if (
      !confirm(
        n > 0
          ? `Delete "${g.name}"? ${n} guest${n === 1 ? "" : "s"} will be moved to "Ungrouped".`
          : `Delete "${g.name}"?`,
      )
    )
      return;
    try {
      await deleteGuestGroup(g.id, wedding.id, g.name);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove.");
    }
  };

  const loading = groups === null || guests === null;

  return (
    <main className="u-main">
      <BackHeader
        title="Groups & roles"
        subtitle={
          guests
            ? `${guests.length} guest${guests.length === 1 ? "" : "s"} · ${(groups ?? []).length} group${(groups ?? []).length === 1 ? "" : "s"}`
            : "Loading…"
        }
        fallback="/guests"
      />

      <SectionLabel style={{ marginTop: 8 }}>Groups</SectionLabel>
      {loading ? (
        <Loading label="Loading groups…" />
      ) : (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {(groups ?? []).map((g) => {
              const p = paletteFor(g.color);
              const count = perGroup.get(g.name)?.length ?? 0;
              return (
                <Card key={g.id} style={{ padding: 14 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
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
                  </div>
                  {editingId === g.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(g)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(g);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      style={{
                        minHeight: 32,
                        padding: "6px 10px",
                        fontSize: 13.5,
                        marginTop: 9,
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => {
                        setEditingId(g.id);
                        setEditingName(g.name);
                      }}
                      style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: T.ink,
                        marginTop: 9,
                        cursor: "text",
                      }}
                    >
                      {g.name}
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
                        aria-label={`colour ${p2.bg}`}
                        onClick={() => changeColor(g, p2.bg)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: p2.bg,
                          border: `1.5px solid ${p2.ring}`,
                          outline:
                            g.color === p2.bg
                              ? `2px solid ${T.ink}`
                              : "none",
                          outlineOffset: 1,
                          padding: 0,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => removeGroup(g)}
                    className="u-link"
                    style={{
                      color: "#C0553B",
                      fontSize: 12,
                      marginTop: 10,
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </Card>
              );
            })}

            <Card
              soft
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <form
                onSubmit={addGroup}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
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
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name it…"
                  style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PALETTE.map((p) => (
                    <button
                      key={p.bg}
                      type="button"
                      onClick={() => setNewColor(p.bg)}
                      aria-label={`colour ${p.bg}`}
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
                <Button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  style={{ minHeight: 38, fontSize: 13 }}
                >
                  {busy ? "Adding…" : "Add group"}
                </Button>
              </form>
            </Card>
          </div>

          {ungroupedCount > 0 && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: T.faint,
                padding: "0 4px",
              }}
            >
              {ungroupedCount} guest{ungroupedCount === 1 ? "" : "s"} not yet in
              a group. Assign one on the guest's page.
            </div>
          )}
        </>
      )}

      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {/* Who's in each group */}
      {(groups ?? []).length > 0 && (guests ?? []).length > 0 && (
        <>
          <SectionLabel>Who&apos;s in each group</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(groups ?? []).map((g) => {
              const p = paletteFor(g.color);
              const members = perGroup.get(g.name) ?? [];
              if (members.length === 0) return null;
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
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: p.bg,
                        border: `1.5px solid ${p.ring}`,
                      }}
                    />
                    <span
                      style={{ fontWeight: 600, fontSize: 13, color: T.ink }}
                    >
                      {g.name}
                    </span>
                    <span style={{ fontSize: 12, color: T.faint }}>
                      {members.length}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {members.map((m) => (
                      <Link key={m.id} href={`/guests/${m.id}`}>
                        <Card
                          onClick={() => {}}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 15px",
                          }}
                        >
                          <Avatar
                            letter={(m.first_name || "?").charAt(0).toUpperCase()}
                            tint="accent"
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
                              {m.first_name} {m.last_name ?? ""}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: T.faint,
                                marginTop: 1,
                              }}
                            >
                              Party of {m.party_size ?? 1}
                              {m.role ? ` · ${m.role}` : ""}
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Real roles list */}
      <SectionLabel>The people with a role</SectionLabel>
      {loading ? null : roles.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, color: T.muted }}>
            No roles assigned yet — open a guest to add one (Maid of honor,
            Best man, Officiant…).
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {roles.map((r) => (
            <Link key={r.id} href={`/guests/${r.id}`}>
              <Card
                onClick={() => {}}
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
                  <div
                    style={{ fontWeight: 600, fontSize: 14, color: T.ink }}
                  >
                    {r.first_name} {r.last_name ?? ""}
                  </div>
                  <div
                    style={{ fontSize: 12, color: T.faint, marginTop: 1 }}
                  >
                    {r.guest_group ?? "Also a witness"}
                  </div>
                </div>
                <span
                  style={{
                    background: T.blueBg,
                    color: T.blueInk,
                    fontWeight: 600,
                    fontSize: 11,
                    padding: "5px 11px",
                    borderRadius: 20,
                    flexShrink: 0,
                  }}
                >
                  {r.role}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
