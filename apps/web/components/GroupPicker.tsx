"use client";

import React, { useMemo, useState } from "react";
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

export function GroupPicker({
  allGroups,
  selected,
  onSelect,
  onDeselect,
  onCreate,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    if (!q) return allGroups;
    return allGroups.filter((g) => g.name.toLowerCase().includes(qLower));
  }, [allGroups, q, qLower]);

  const canCreate =
    q.length > 0 && !allGroups.some((g) => g.name.toLowerCase() === qLower);

  const toggle = async (g: GroupChip) => {
    setErr(null);
    setBusy(true);
    try {
      const isMember =
        selectedIds.has(g.id) || selectedNames.has(g.name.toLowerCase());
      if (isMember) {
        await onDeselect(g);
      } else {
        await onSelect(g);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update groups.");
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        {selected.length === 0 && (
          <span style={{ fontSize: 13, color: T.faint }}>
            Not in any group yet.
          </span>
        )}
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
              onClick={() => toggle(cg)}
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={disabled}
          style={{
            padding: "5px 10px",
            borderRadius: 20,
            border: `1px dashed ${T.line3}`,
            background: "#fff",
            color: T.muted,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add group
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${T.line3}`,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a group or type to create…"
            disabled={disabled || busy}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${T.line3}`,
              fontSize: 13,
              fontFamily: T.sans,
              color: T.ink,
              background: "#fff",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {filtered.length === 0 && !canCreate && (
              <div
                style={{
                  fontSize: 13,
                  color: T.faint,
                  padding: "6px 8px",
                }}
              >
                No groups yet.
              </div>
            )}
            {filtered.map((g) => {
              const isMember =
                selectedIds.has(g.id) ||
                selectedNames.has(g.name.toLowerCase());
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    toggle({ id: g.id, name: g.name, color: g.color })
                  }
                  disabled={disabled || busy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isMember ? T.accentSoft : "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                    color: T.ink,
                  }}
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
              );
            })}
            {canCreate && (
              <button
                type="button"
                onClick={create}
                disabled={disabled || busy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "transparent",
                  border: `1px dashed ${T.line3}`,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  color: T.ink,
                  marginTop: filtered.length ? 4 : 0,
                }}
              >
                + Create &ldquo;{q}&rdquo;
              </button>
            )}
          </div>
          {err && (
            <div style={{ fontSize: 12, color: "#C0553B" }}>{err}</div>
          )}
        </div>
      )}
    </div>
  );
}
