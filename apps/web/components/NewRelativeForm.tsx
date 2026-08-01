"use client";

import React from "react";
import type { NewRelatedGuest } from "@/lib/data";

/**
 * Editable card for a not-yet-persisted related guest (child or
 * partner) that the parent form is holding in state. Used both by
 * the add-guest page and by the guest detail page.
 *
 * Renders the same field set as a full guest edit — first, last,
 * email, phone, age, notes — so nothing ever silently degrades to
 * "name only" like the previous "+ Add a child" mini-form did.
 */
export function NewRelativeForm({
  value,
  onChange,
  onRemove,
  removeLabel = "Remove",
  autoFocus = false,
  ageLabel = "Age (optional)",
}: {
  value: NewRelatedGuest;
  onChange: (patch: Partial<NewRelatedGuest>) => void;
  onRemove?: () => void;
  removeLabel?: string;
  autoFocus?: boolean;
  ageLabel?: string;
}) {
  const setAge = (raw: string) => {
    if (raw.trim() === "") {
      onChange({ age_years: null });
      return;
    }
    const parsed = Math.max(0, Math.min(130, parseInt(raw, 10)));
    onChange({ age_years: Number.isFinite(parsed) ? parsed : null });
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        border: "1px solid rgba(67,53,58,.12)",
        borderRadius: 12,
        background: "rgba(255,255,255,.55)",
      }}
    >
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <input
          type="text"
          placeholder="First name"
          value={value.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          autoFocus={autoFocus}
          required
        />
        <input
          type="text"
          placeholder="Last name"
          value={value.last_name ?? ""}
          onChange={(e) => onChange({ last_name: e.target.value })}
        />
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <input
          type="email"
          placeholder="Email (optional)"
          value={value.email ?? ""}
          onChange={(e) => onChange({ email: e.target.value })}
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={value.phone ?? ""}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </div>
      <input
        type="number"
        min={0}
        max={130}
        placeholder={ageLabel}
        value={value.age_years == null ? "" : String(value.age_years)}
        onChange={(e) => setAge(e.target.value)}
      />
      <input
        type="text"
        placeholder="Group (optional — e.g. Bride's family)"
        value={value.guest_group ?? ""}
        onChange={(e) => onChange({ guest_group: e.target.value })}
      />
      <input
        type="text"
        placeholder="Role (optional — bridesmaid, ring bearer…)"
        value={value.role ?? ""}
        onChange={(e) => onChange({ role: e.target.value })}
      />
      <textarea
        placeholder="Notes (optional)"
        value={value.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        rows={2}
      />
      {onRemove && (
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={onRemove}
            className="u-link"
            style={{ fontSize: 12.5, color: "#C0553B" }}
          >
            {removeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
