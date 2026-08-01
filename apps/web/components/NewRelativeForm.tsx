"use client";

import React, { useId } from "react";
import type { GuestGroup } from "@union/shared";
import type { NewRelatedGuest } from "@/lib/data";
import { GroupPicker, type GroupChip } from "@/components/GroupPicker";
import { T } from "@/lib/theme";

/**
 * Editable card for a not-yet-persisted related guest (child, partner
 * or parent) that the enclosing form is holding in state. Used both
 * by the add-guest page and by the guest detail page.
 *
 * Renders the same field set as a full guest edit — first, last,
 * email, phone, age, groups (multi-select chip picker), role,
 * notes — so nothing silently degrades to a name-only mini-form.
 *
 * `allGroups` powers the group chip picker; `onCreateGroup` is called
 * when the user types a group that doesn't exist yet, so the group
 * row lands in the DB with a real id + colour before it's attached
 * to this draft.
 */
export function NewRelativeForm({
  value,
  onChange,
  onRemove,
  removeLabel = "Remove",
  autoFocus = false,
  ageLabel = "Age (optional)",
  allGroups = [],
  onCreateGroup,
  suggestedRoles = [],
}: {
  value: NewRelatedGuest;
  onChange: (patch: Partial<NewRelatedGuest>) => void;
  onRemove?: () => void;
  removeLabel?: string;
  autoFocus?: boolean;
  ageLabel?: string;
  allGroups?: GuestGroup[];
  onCreateGroup?: (name: string) => Promise<GroupChip>;
  suggestedRoles?: string[];
}) {
  const uid = useId();
  const rolesListId = `nrf-roles-${uid}`;
  const chips: GroupChip[] = value.group_chips ?? [];

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
      {onCreateGroup && (
        <div>
          <div style={{ fontSize: 12, color: T.faint, marginBottom: 4 }}>
            Groups
          </div>
          <GroupPicker
            allGroups={allGroups}
            selected={chips}
            onSelect={(g) => {
              if (chips.some((c) => c.id === g.id)) return;
              onChange({ group_chips: [...chips, g] });
            }}
            onDeselect={(g) => {
              onChange({ group_chips: chips.filter((c) => c.id !== g.id) });
            }}
            onCreate={onCreateGroup}
          />
        </div>
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
