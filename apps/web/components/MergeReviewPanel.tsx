"use client";

import React, { useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Button } from "@/components/ui";
import {
  ownerMergeGuests,
  type MergeOverrides,
} from "@/lib/data";

/**
 * Any guest-like object with the fields that matter for a merge.
 * Both the duplicates page (DuplicateCandidate) and the voluntary
 * merge flow (Guest) satisfy this — the panel only reads the
 * intersection.
 */
export type MergeableGuest = {
  id: string;
  first_name: string;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  age_years?: number | null;
  role?: string | null;
  notes?: string | null;
  guest_group?: string | null;
  rsvp_status?: string | null;
  added_by_first_name?: string | null;
};

// Fields the merge RPC understands as overrides. Displayed in this
// order — the panel walks the list and renders a row per field so
// the user sees the full identity of the merged result up front.
const FIELDS: Array<{
  key: keyof MergeOverrides;
  label: string;
  kind: "text" | "email" | "tel" | "int";
}> = [
  { key: "first_name", label: "First name", kind: "text" },
  { key: "last_name", label: "Last name", kind: "text" },
  { key: "email", label: "Email", kind: "email" },
  { key: "phone", label: "Phone", kind: "tel" },
  { key: "age_years", label: "Age", kind: "int" },
  { key: "guest_group", label: "Group (primary)", kind: "text" },
  { key: "role", label: "Role", kind: "text" },
  { key: "notes", label: "Notes", kind: "text" },
];

const displayValue = (v: unknown): string => {
  if (v == null || v === "") return "";
  return String(v);
};

/**
 * Which guest, of the cluster, should stay (target)? Pick the one
 * with the most non-null values (fields the client can see), tie-
 * broken by the first in the array. This is a UI hint — every field
 * the user resolves overrides it anyway, and the merge is symmetric
 * once conflicts are resolved.
 */
function pickDefaultTargetId(guests: MergeableGuest[]): string {
  const fields: Array<keyof MergeableGuest> = [
    "last_name",
    "email",
    "phone",
    "age_years",
    "guest_group",
    "role",
    "notes",
  ];
  let bestId = guests[0].id;
  let bestScore = -1;
  for (const g of guests) {
    const score = fields.reduce(
      (n, f) => n + (g[f] != null && g[f] !== "" ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestId = g.id;
    }
  }
  return bestId;
}

export function MergeReviewPanel({
  guests,
  onDone,
  onCancel,
}: {
  guests: MergeableGuest[];
  onDone: (survivingId: string) => void;
  onCancel: () => void;
}) {
  const defaultTargetId = useMemo(() => pickDefaultTargetId(guests), [guests]);
  const [targetId, setTargetId] = useState<string>(defaultTargetId);
  const target = guests.find((g) => g.id === targetId) ?? guests[0];
  const others = guests.filter((g) => g.id !== target.id);

  // Per-field resolution. undefined = "leave alone" (server's
  // COALESCE(target, source) applies); a string = pick / typed value;
  // null = user explicitly picked "leave blank".
  const [picks, setPicks] = useState<Record<string, string | null | undefined>>({});
  const [customFocus, setCustomFocus] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For each field, collect the distinct non-null values across the
  // cluster (with who they came from), plus the count of guests
  // that have nothing set. `conflicts.length > 1` = user must pick.
  const rows = useMemo(() => {
    return FIELDS.map((f) => {
      const collected: Array<{ v: string; owners: MergeableGuest[] }> = [];
      let missing = 0;
      for (const g of guests) {
        const raw = (g as unknown as Record<string, unknown>)[f.key];
        const norm =
          raw == null || raw === "" ? null : String(raw);
        if (norm == null) {
          missing += 1;
          continue;
        }
        const existing = collected.find((c) => c.v === norm);
        if (existing) existing.owners.push(g);
        else collected.push({ v: norm, owners: [g] });
      }
      return { field: f, values: collected, missing };
    });
  }, [guests]);

  const conflictCount = rows.filter((r) => r.values.length > 1).length;
  const matchCount = rows.filter(
    (r) =>
      r.values.length === 1 &&
      r.values[0].owners.length === guests.length,
  ).length;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const overrides: MergeOverrides = {};
      for (const f of FIELDS) {
        const pick = picks[f.key];
        if (pick === undefined) continue;
        if (f.kind === "int") {
          if (pick === null || pick === "") {
            (overrides as Record<string, unknown>)[f.key] = null;
          } else {
            const n = Math.max(0, Math.min(130, parseInt(pick, 10)));
            (overrides as Record<string, unknown>)[f.key] = Number.isFinite(n)
              ? n
              : null;
          }
        } else {
          (overrides as Record<string, unknown>)[f.key] =
            pick == null || pick.trim() === "" ? null : pick.trim();
        }
      }
      // Fold every non-target guest into target, in order. Each
      // fold is one RPC call inside its own transaction. Overrides
      // apply on the first fold; subsequent folds just carry
      // relationships / RSVP / groups over.
      let survivingId = target.id;
      for (let i = 0; i < others.length; i += 1) {
        const src = others[i];
        survivingId = await ownerMergeGuests(
          src.id,
          survivingId,
          i === 0 ? overrides : undefined,
        );
      }
      onDone(survivingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12.5, color: T.muted }}>
        {conflictCount === 0 ? (
          <>
            Every field matches across {guests.length} guests. The merge is
            safe.
          </>
        ) : (
          <>
            {matchCount} matching field{matchCount === 1 ? "" : "s"},{" "}
            <b>{conflictCount}</b> to resolve. Every field is shown below so
            you can double-check before confirming.
          </>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(({ field, values, missing }) => {
          const isConflict = values.length > 1;
          const isAgreed =
            values.length === 1 && values[0].owners.length === guests.length;
          const isPartial =
            values.length === 1 && values[0].owners.length < guests.length;
          const isAllBlank = values.length === 0;
          const pick = picks[field.key];
          const focused = !!customFocus[field.key];
          const isPicked = (v: string | null) =>
            pick !== undefined && (v == null ? pick == null : pick === v);
          return (
            <div
              key={field.key}
              style={{
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${
                  isConflict ? "rgba(192,85,59,.35)" : "rgba(67,53,58,.10)"
                }`,
                background: isConflict ? "rgba(255,248,244,.6)" : "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {field.label}
                </div>
                <div style={{ fontSize: 11.5, color: T.faint }}>
                  {isConflict
                    ? `${values.length} different values`
                    : isAgreed
                      ? "all match"
                      : isPartial
                        ? `${values[0].owners.length}/${guests.length} set`
                        : "all blank"}
                </div>
              </div>

              {isAllBlank ? (
                <div style={{ fontSize: 13, color: T.faint }}>
                  <em>Blank on every guest.</em>
                </div>
              ) : isAgreed || (isPartial && !isConflict) ? (
                // Non-conflicting: show the single value read-only.
                // Partial (one guest has it, another doesn't) is
                // safe too — the merge always keeps the non-null.
                <div style={{ fontSize: 13, color: T.ink }}>
                  {displayValue(values[0].v)}
                  {isPartial && (
                    <span
                      style={{ fontSize: 12, color: T.faint, marginLeft: 8 }}
                    >
                      (blank on {guests.length - values[0].owners.length}{" "}
                      other)
                    </span>
                  )}
                </div>
              ) : (
                // Conflict: radio-select over each value + optional
                // blank + optional custom.
                <div style={{ display: "grid", gap: 6 }}>
                  {values.map((d, i) => (
                    <label
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name={`merge-${field.key}`}
                        checked={isPicked(d.v)}
                        onChange={() =>
                          setPicks((p) => ({ ...p, [field.key]: d.v }))
                        }
                      />
                      <span style={{ flex: 1 }}>{displayValue(d.v)}</span>
                      <span style={{ fontSize: 11, color: T.faint }}>
                        from {d.owners.map((o) => o.first_name).join(", ")}
                      </span>
                    </label>
                  ))}
                  {missing > 0 && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name={`merge-${field.key}`}
                        checked={isPicked(null)}
                        onChange={() =>
                          setPicks((p) => ({ ...p, [field.key]: null }))
                        }
                      />
                      <span style={{ flex: 1, color: T.faint }}>
                        <em>Leave blank</em>
                      </span>
                      <span style={{ fontSize: 11, color: T.faint }}>
                        (blank on {missing})
                      </span>
                    </label>
                  )}
                  {focused ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="radio"
                        name={`merge-${field.key}`}
                        checked={
                          pick !== undefined &&
                          pick !== null &&
                          !values.some((d) => d.v === pick)
                        }
                        onChange={() =>
                          setPicks((p) => ({ ...p, [field.key]: pick ?? "" }))
                        }
                      />
                      <input
                        type={
                          field.kind === "int"
                            ? "number"
                            : field.kind === "email"
                              ? "email"
                              : field.kind === "tel"
                                ? "tel"
                                : "text"
                        }
                        autoFocus
                        value={pick == null ? "" : String(pick)}
                        onChange={(e) =>
                          setPicks((p) => ({
                            ...p,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder="Custom value"
                        style={{ flex: 1 }}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFocus((f) => ({ ...f, [field.key]: true }))
                      }
                      className="u-link"
                      style={{
                        fontSize: 12.5,
                        textAlign: "left",
                        color: T.muted2,
                      }}
                    >
                      + Enter a different value
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {guests.length === 2 && (
        <details style={{ fontSize: 12.5, color: T.muted }}>
          <summary style={{ cursor: "pointer" }}>Advanced: swap target</summary>
          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
            {guests.map((g) => (
              <label
                key={g.id}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="radio"
                  name="merge-target"
                  checked={targetId === g.id}
                  onChange={() => setTargetId(g.id)}
                />
                Keep {g.first_name} {g.last_name ?? ""}'s row id
              </label>
            ))}
            <span style={{ color: T.faint }}>
              Usually irrelevant — the surviving row's field values come from
              your picks above.
            </span>
          </div>
        </details>
      )}

      {error && (
        <div className="error" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={() => void confirm()} disabled={busy} style={{ flex: 1 }}>
          {busy ? "Merging…" : "Merge"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
