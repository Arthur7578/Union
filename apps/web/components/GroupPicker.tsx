"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GuestGroup } from "@union/shared";
import { T } from "@/lib/theme";

export type GroupChip = {
  id: string;
  name: string;
  color?: string | null;
};

type Props = {
  allGroups: GuestGroup[];
  selected: GroupChip[];
  onSelect: (g: GroupChip) => void | Promise<void>;
  onDeselect: (g: GroupChip) => void | Promise<void>;
  onCreate: (name: string) => Promise<GroupChip>;
  disabled?: boolean;
};

/**
 * Chip-based multi-select for guest groups. Selected groups render
 * as coloured chips; a search input filters the remaining ones and
 * offers a "+ Create X" row when the typed name doesn't match. The
 * search dropdown lives inline (no toggle button), so picking or
 * creating a group is a single interaction.
 */
export function GroupPicker({
  allGroups,
  selected,
  onSelect,
  onDeselect,
  onCreate,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );
  const selectedNames = useMemo(
    () => new Set(selected.map((s) => s.name.toLowerCase())),
    [selected],
  );

  const q = query.trim();
  const qLower = q.toLowerCase();

  // Only show groups the user isn't already in; that's the "add"
  // action. Removing a group is the chip's × button.
  const filtered = useMemo(() => {
    return allGroups
      .filter((g) => !selectedIds.has(g.id) && !selectedNames.has(g.name.toLowerCase()))
      .filter((g) => (q ? g.name.toLowerCase().includes(qLower) : true));
  }, [allGroups, selectedIds, selectedNames, q, qLower]);

  const canCreate =
    q.length > 0 && !allGroups.some((g) => g.name.toLowerCase() === qLower);

  // Close the dropdown on outside click so it doesn't linger.
  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [focused]);

  const add = async (g: GroupChip) => {
    setErr(null);
    setBusy(true);
    try {
      await onSelect(g);
      setQuery("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add group.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g: GroupChip) => {
    setErr(null);
    setBusy(true);
    try {
      await onDeselect(g);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't remove group.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!canCreate) return;
    setErr(null);
    setBusy(true);
    try {
      const created = await onCreate(q);
      await onSelect(created);
      setQuery("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create group.");
    } finally {
      setBusy(false);
    }
  };

  const showDropdown = focused && (filtered.length > 0 || canCreate);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {selected.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 8,
          }}
        >
          {selected.map((cg) => (
            <span
              key={cg.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 20,
                background: cg.color ?? T.accentSoft,
                border: `1px solid ${T.line3}`,
                fontSize: 12.5,
                fontWeight: 600,
                color: T.ink,
              }}
            >
              {cg.name}
              <button
                type="button"
                aria-label={`Remove ${cg.name}`}
                onClick={() => remove(cg)}
                disabled={disabled || busy}
                style={{
                  background: "none",
                  border: "none",
                  color: T.muted,
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={
          selected.length === 0
            ? "Search groups or type to create…"
            : "Add another group…"
        }
        disabled={disabled || busy}
      />

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: 2,
            padding: 4,
            borderRadius: 10,
            border: `1px solid ${T.line3}`,
            background: "#fff",
            boxShadow: "0 6px 22px rgba(67,53,58,.12)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 20,
          }}
        >
          {filtered.map((g) => (
            <button
              key={g.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                void add({ id: g.id, name: g.name, color: g.color })
              }
              disabled={disabled || busy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                color: T.ink,
              }}
            >
              {g.color && (
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: g.color,
                    border: `1px solid ${T.line3}`,
                  }}
                />
              )}
              <span>{g.name}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void create()}
              disabled={disabled || busy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(224,204,177,.35)",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: T.ink,
                marginTop: filtered.length ? 4 : 0,
              }}
            >
              + Create &ldquo;{q}&rdquo;
            </button>
          )}
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12, color: "#C0553B", marginTop: 6 }}>
          {err}
        </div>
      )}
    </div>
  );
}
