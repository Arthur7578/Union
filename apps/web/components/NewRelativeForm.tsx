"use client";

import React, { useId } from "react";
import type { NewRelatedGuest } from "@/lib/data";

/**
 * Editable card for a not-yet-persisted related guest (child, partner
 * or parent) that the enclosing form is holding in state. Used both
 * by the add-guest page and by the guest detail page.
 *
 * Renders the same field set as a full guest edit — first, last,
 * email, phone, age, group, role, notes — so nothing silently
 * degrades to a name-only mini-form.
 *
 * `existingGroups` and `suggestedRoles` power the autocomplete on
 * the group and role inputs so the user can pick from what already
 * exists on the wedding without having to remember the exact name.
 * Typing a new name is still allowed (create-on-save inside the RPC).
 */
export function NewRelativeForm({
  value,
  onChange,
  onRemove,
  removeLabel = "Remove",
  autoFocus = false,
  ageLabel = "Age (optional)",
  existingGroups = [],
  suggestedRoles = [],
}: {
  value: NewRelatedGuest;
  onChange: (patch: Partial<NewRelatedGuest>) => void;
  onRemove?: () => void;
  removeLabel?: string;
  autoFocus?: boolean;
  ageLabel?: string;
  existingGroups?: string[];
  suggestedRoles?: string[];
}) {
  // useId keeps the datalists distinct when several NewRelativeForm
  // instances are on the same page (e.g. multiple new children).
  const uid = useId();
  const groupsListId = `nrf-groups-${uid}`;
  const rolesListId = `nrf-roles-${uid}`;

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
        list={existingGroups.length > 0 ? groupsListId : undefined}
        placeholder="Group (pick or type a new one — e.g. Bride's family)"
        value={value.guest_group ?? ""}
        onChange={(e) => onChange({ guest_group: e.target.value })}
      />
      {existingGroups.length > 0 && (
        <datalist id={groupsListId}>
          {existingGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      )}
      <input
        type="text"
        list={suggestedRoles.length > 0 ? rolesListId : undefined}
        placeholder="Role (optional — bridesmaid, ring bearer…)"
        value={value.role ?? ""}
        onChange={(e) => onChange({ role: e.target.value })}
      />
      {suggestedRoles.length > 0 && (
        <datalist id={rolesListId}>
          {suggestedRoles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      )}
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
