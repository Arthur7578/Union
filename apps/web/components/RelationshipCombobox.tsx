"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import type { GuestWithRsvp } from "@/lib/data";

/**
 * Single input that unifies "link an existing guest" and "add a new
 * guest" for one relationship (partner, child, or parent). The user
 * types; the dropdown filters the wedding's guests to matches; a
 * final row in the dropdown offers to spin up a brand-new guest with
 * the typed name.
 *
 * Pure UI: no writes. Callers own the list of already-chosen items
 * (chips) and decide what to do with the "create new" click — the
 * add-guest form batches it into a create_guest_with_links call, the
 * edit page opens an inline full-detail form and then calls the RPC.
 */
export function RelationshipCombobox({
  label,
  placeholder,
  guests,
  excludeIds,
  canCreate = true,
  createLabel = "Add",
  onPickExisting,
  onStartCreate,
}: {
  label: string;
  placeholder?: string;
  guests: GuestWithRsvp[];
  excludeIds: string[];
  canCreate?: boolean;
  createLabel?: string;
  onPickExisting: (guest: GuestWithRsvp) => void;
  onStartCreate: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => !excluded.has(g.id))
      .filter((g) => {
        if (!q) return true;
        const hay = `${g.first_name} ${g.last_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [guests, excluded, query]);

  const showCreate = canCreate && query.trim().length > 0;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <label style={{ fontSize: 13, color: T.muted, display: "grid", gap: 4 }}>
        {label}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Type a name…"}
        />
      </label>
      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: 2,
            background: "#fff",
            border: "1px solid rgba(67,53,58,.15)",
            borderRadius: 8,
            boxShadow: "0 6px 22px rgba(67,53,58,.12)",
            maxHeight: 260,
            overflowY: "auto",
            zIndex: 20,
          }}
        >
          {matches.length === 0 && !showCreate && (
            <div style={{ padding: "10px 12px", fontSize: 13, color: T.faint }}>
              {query.trim()
                ? "No match."
                : canCreate
                  ? "Type a name — or add someone new."
                  : "Type a name."}
            </div>
          )}
          {matches.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onPickExisting(g);
                setQuery("");
                setOpen(false);
              }}
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                gap: 6,
                borderBottom: "1px solid rgba(67,53,58,.06)",
                color: T.ink,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span style={{ flex: 1 }}>
                {g.first_name} {g.last_name ?? ""}
              </span>
              <span style={{ fontSize: 11, color: T.faint }}>
                {g.email ?? g.phone ?? g.guest_group ?? ""}
              </span>
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={() => {
                onStartCreate(query.trim());
                setQuery("");
                setOpen(false);
              }}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "rgba(224,204,177,.35)",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: T.ink,
              }}
            >
              + {createLabel} "{query.trim()}" as a new guest
            </button>
          )}
        </div>
      )}
    </div>
  );
}
