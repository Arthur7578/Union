"use client";

import React, { useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Button } from "@/components/ui";
import {
  ownerMergeGuests,
  type MergeOverrides,
  type DuplicateCandidate,
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
// order in the review panel — most identifying first.
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

  // Per-field resolution: undefined = leave alone (fall back to
  // COALESCE(target, source) inside the RPC), otherwise the value
  // the user picked or typed. `null` means "leave blank".
  const [picks, setPicks] = useState<Record<string, string | null | undefined>>({});
  const [customFocus, setCustomFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conflicts = useMemo(() => {
    return FIELDS.map((f) => {
      const values = guests
        .map((g) => (g as unknown as Record<string, unknown>)[f.key])
        .map((v) => (v == null || v === "" ? null : v));
      const distinct: Array<{ v: unknown; owners: MergeableGuest[] }> = [];
      values.forEach((v, i) => {
        const key = v == null ? "__null__" : String(v);
        const existing = distinct.find(
          (d) => (d.v == null ? "__null__" : String(d.v)) === key,
        );
        if (existing) existing.owners.push(guests[i]);
        else distinct.push({ v, owners: [guests[i]] });
      });
      const nonNull = distinct.filter((d) => d.v != null);
      return { field: f, distinct, nonNull };
    });
  }, [guests]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      // Build overrides: everything the user actively picked. For
      // fields with only one candidate value across the cluster the
      // RPC's COALESCE will pull it in without an explicit override.
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
      // Fold every non-target guest into target, in order. Each fold
      // is one RPC call and one transaction; the first fold applies
      // any overrides, the rest just merge remaining relationships.
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
      {guests.length > 2 && (
        <div style={{ fontSize: 12.5, color: T.muted }}>
          Merging {guests.length} guests. Any picks you make apply to the
          result; unresolved fields keep the first non-empty value.
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {conflicts.map(({ field, distinct, nonNull }) => {
          // Skip fields where every guest has the same value (or all
          // null) — nothing to resolve, nothing to show.
          if (distinct.length <= 1) return null;
          if (nonNull.length === 0) return null;
          const pick = picks[field.key];
          const isPicked = (v: unknown) =>
            pick !== undefined &&
            (v == null ? pick == null : pick === String(v));
          return (
            <div
              key={field.key}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(67,53,58,.12)",
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {field.label}{" "}
                <span style={{ fontWeight: 400, color: T.muted, fontSize: 12 }}>
                  · {nonNull.length > 1 ? "conflict" : "only one value"}
                </span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {distinct.map((d, i) => (
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
                        setPicks((p) => ({
                          ...p,
                          [field.key]: d.v == null ? null : String(d.v),
                        }))
                      }
                    />
                    <span style={{ flex: 1 }}>
                      {d.v == null ? (
                        <em style={{ color: T.faint }}>Leave blank</em>
                      ) : (
                        displayValue(d.v)
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: T.faint }}>
                      from {d.owners.map((o) => o.first_name).join(", ")}
                    </span>
                  </label>
                ))}
                {customFocus === field.key ? (
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
                        !distinct.some((d) => isPicked(d.v))
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
                        setPicks((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      placeholder="Custom value"
                      style={{ flex: 1 }}
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustomFocus(field.key)}
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
            </div>
          );
        })}
        {conflicts.every(({ distinct, nonNull }) => distinct.length <= 1 || nonNull.length === 0) && (
          <div
            style={{
              fontSize: 13,
              color: T.muted,
              padding: 10,
              borderRadius: 10,
              background: "rgba(67,53,58,.04)",
            }}
          >
            No conflicting fields — the merge will combine them cleanly.
          </div>
        )}
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
