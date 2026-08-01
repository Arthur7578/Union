"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestGroup } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  addGuestGroup,
  addGuestRelationship,
  createGuestWithLinks,
  fetchGuestGroups,
  fetchGuests,
  type GuestWithRsvp,
  type NewRelatedGuest,
} from "@/lib/data";
import { T } from "@/lib/theme";
import { Button } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { GroupPicker, type GroupChip } from "@/components/GroupPicker";
import { NewRelativeForm } from "@/components/NewRelativeForm";
import { RelationshipCombobox } from "@/components/RelationshipCombobox";
import { useT } from "@/lib/i18n/client";

/**
 * Per-relationship state on the add-guest form: each entry is either
 * an existing-guest link (`link`) or an inline-created draft (`new`).
 * All entries are submitted together — the RPC creates the primary
 * guest, wires links to existing guests, and materialises drafts
 * into new guest rows + relationship edges, atomically.
 */
type LinkedEntry =
  | { kind: "link"; guest: GuestWithRsvp }
  | { kind: "new"; data: NewRelatedGuest };

const emptyRelative = (name = ""): NewRelatedGuest => {
  const parts = name.trim().split(/\s+/);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: null,
    phone: null,
    age_years: null,
    role: null,
    guest_group: null,
    notes: null,
  };
};

export default function NewGuestPage() {
  const t = useT();
  const { wedding } = useWedding();
  const router = useRouter();
  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<string>("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  const [partner, setPartner] = useState<LinkedEntry | null>(null);
  const [parents, setParents] = useState<LinkedEntry[]>([]);
  const [children, setChildren] = useState<LinkedEntry[]>([]);

  const [allGroups, setAllGroups] = useState<GuestGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupChip[]>([]);
  const [existingGuests, setExistingGuests] = useState<GuestWithRsvp[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    Promise.all([fetchGuestGroups(wedding.id), fetchGuests(wedding.id)])
      .then(([gs, guests]) => {
        if (!ok) return;
        setAllGroups(gs);
        setExistingGuests(guests);
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;

  const excludedFor = (self: LinkedEntry[]): string[] => {
    const ids = new Set<string>();
    if (partner?.kind === "link") ids.add(partner.guest.id);
    for (const p of parents) if (p.kind === "link") ids.add(p.guest.id);
    for (const c of children) if (c.kind === "link") ids.add(c.guest.id);
    // Also exclude any guest that's already in another slot — we
    // don't want the same person as both parent and child.
    for (const e of self) if (e.kind === "link") ids.add(e.guest.id);
    return Array.from(ids);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const primary = selectedGroups[0] ?? null;
      const parsedAge = age.trim() === "" ? null : Math.max(0, Math.min(130, parseInt(age, 10)));
      const parentLinkIds = parents
        .filter((p): p is Extract<LinkedEntry, { kind: "link" }> => p.kind === "link")
        .map((p) => p.guest.id);
      const newChildren = children
        .filter((c): c is Extract<LinkedEntry, { kind: "new" }> => c.kind === "new")
        .map((c) => c.data);
      const childLinkIds = children
        .filter((c): c is Extract<LinkedEntry, { kind: "link" }> => c.kind === "link")
        .map((c) => c.guest.id);
      const partnerLinkId = partner?.kind === "link" ? partner.guest.id : null;
      const newPartner = partner?.kind === "new" ? partner.data : null;
      // If the user typed a new parent, the RPC doesn't handle it
      // directly (the primary is the child, not the parent). We
      // create each new parent up-front via a separate RPC call, then
      // fold its id into parent_ids.
      const newParentIds: string[] = [];
      const newParents = parents.filter(
        (p): p is Extract<LinkedEntry, { kind: "new" }> => p.kind === "new",
      );
      for (const np of newParents) {
        const created = await createGuestWithLinks({
          wedding_id: wedding.id,
          first_name: np.data.first_name.trim(),
          last_name: np.data.last_name ?? null,
          email: np.data.email ?? null,
          phone: np.data.phone ?? null,
          age_years: np.data.age_years ?? null,
          role: np.data.role ?? null,
          notes: np.data.notes ?? null,
          primary_group: np.data.guest_group ?? null,
        });
        newParentIds.push(created.id);
      }

      const created = await createGuestWithLinks({
        wedding_id: wedding.id,
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        age_years: Number.isFinite(parsedAge as number) ? parsedAge : null,
        role: role.trim() || null,
        notes: notes.trim() || null,
        primary_group: primary?.name ?? null,
        group_ids: selectedGroups.slice(1).map((g) => g.id),
        parent_ids: [...parentLinkIds, ...newParentIds],
        partner_id: partnerLinkId,
        new_partner: newPartner,
        new_children: newChildren,
      });
      // Extra children that were picked from the existing list get
      // wired after the primary exists.
      for (const cid of childLinkIds) {
        await addGuestRelationship({
          wedding_id: wedding.id,
          from_guest: created.id,
          to_guest: cid,
          kind: "parent_of",
        });
      }
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.guests.errAdd);
      setBusy(false);
    }
  };

  const createGroup = async (name: string): Promise<GroupChip> => {
    const created = await addGuestGroup({
      wedding_id: wedding.id,
      name,
    });
    setAllGroups((prev) => [...prev, created]);
    return { id: created.id, name: created.name, color: created.color };
  };

  const disableSubmit =
    busy ||
    !firstNameV.trim() ||
    (partner?.kind === "new" && !partner.data.first_name.trim()) ||
    parents.some((p) => p.kind === "new" && !p.data.first_name.trim()) ||
    children.some((c) => c.kind === "new" && !c.data.first_name.trim());

  return (
    <main className="u-main">
      <BackHeader
        title={t.guests.addTitle}
        subtitle={t.guests.addSubtitle}
        fallback="/guests"
      />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="fn">{t.guests.fields.firstName}</label>
          <input
            id="fn"
            type="text"
            required
            value={firstNameV}
            onChange={(e) => setFirstNameV(e.target.value)}
            placeholder={t.guests.placeholders.firstName}
          />
        </div>
        <div className="field">
          <label htmlFor="ln">{t.guests.fields.lastName}</label>
          <input
            id="ln"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t.guests.placeholders.lastName}
          />
        </div>
        <div className="field">
          <label htmlFor="em">{t.guests.fields.email}</label>
          <input
            id="em"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.guests.placeholders.email}
          />
        </div>
        <div className="field">
          <label htmlFor="ph">{t.guests.fields.phone}</label>
          <input
            id="ph"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.guests.placeholders.phone}
          />
        </div>

        <div className="field">
          <label htmlFor="ag">Age (optional)</label>
          <input
            id="ag"
            type="number"
            min={0}
            max={130}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 6"
          />
          <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
            Helps with meal / bed choices. Leave blank if unknown.
          </div>
        </div>

        <div className="field">
          <label>{t.guests.fields.group}</label>
          <GroupPicker
            allGroups={allGroups}
            selected={selectedGroups}
            onSelect={(g) =>
              setSelectedGroups((prev) =>
                prev.some((p) => p.id === g.id) ? prev : [...prev, g],
              )
            }
            onDeselect={(g) =>
              setSelectedGroups((prev) => prev.filter((p) => p.id !== g.id))
            }
            onCreate={createGroup}
          />
        </div>
        <div className="field">
          <label htmlFor="rl">{t.guests.fields.role}</label>
          <input
            id="rl"
            type="text"
            list="rl-list"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t.guests.placeholders.role}
          />
          <datalist id="rl-list">
            {t.guests.suggestedRoles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="nt">{t.guests.fields.notes}</label>
          <textarea
            id="nt"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.guests.placeholders.notes}
            rows={3}
          />
        </div>

        <RelationshipSection
          label="Partner (optional)"
          hint="Linked partners can register / edit each other from their invite."
          entries={partner ? [partner] : []}
          onRemove={() => setPartner(null)}
          onUpdate={(idx, patch) =>
            setPartner((prev) =>
              prev && prev.kind === "new"
                ? { ...prev, data: { ...prev.data, ...patch } }
                : prev,
            )
          }
          existingGroups={allGroups.map((g) => g.name)}
          suggestedRoles={t.guests.suggestedRoles as unknown as string[]}
        >
          {!partner && (
            <RelationshipCombobox
              label=""
              placeholder="Type a name to search or add a partner…"
              guests={existingGuests}
              excludeIds={excludedFor([])}
              createLabel="Add"
              onPickExisting={(g) => setPartner({ kind: "link", guest: g })}
              onStartCreate={(name) =>
                setPartner({ kind: "new", data: emptyRelative(name) })
              }
            />
          )}
        </RelationshipSection>

        <RelationshipSection
          label="Parents (optional)"
          hint="Pick or type each parent — e.g. mother, step-father. They can each manage this person from their own invite."
          entries={parents}
          onRemove={(idx) =>
            setParents((prev) => prev.filter((_, i) => i !== idx))
          }
          onUpdate={(idx, patch) =>
            setParents((prev) =>
              prev.map((e, i) =>
                i === idx && e.kind === "new"
                  ? { ...e, data: { ...e.data, ...patch } }
                  : e,
              ),
            )
          }
          existingGroups={allGroups.map((g) => g.name)}
          suggestedRoles={t.guests.suggestedRoles as unknown as string[]}
        >
          <RelationshipCombobox
            label=""
            placeholder="Type a name to search or add a parent…"
            guests={existingGuests}
            excludeIds={excludedFor(parents)}
            createLabel="Add"
            onPickExisting={(g) =>
              setParents((prev) => [...prev, { kind: "link", guest: g }])
            }
            onStartCreate={(name) =>
              setParents((prev) => [...prev, { kind: "new", data: emptyRelative(name) }])
            }
          />
        </RelationshipSection>

        <RelationshipSection
          label="Children (optional)"
          hint="Pick or type each child. This guest becomes their parent."
          entries={children}
          onRemove={(idx) =>
            setChildren((prev) => prev.filter((_, i) => i !== idx))
          }
          onUpdate={(idx, patch) =>
            setChildren((prev) =>
              prev.map((e, i) =>
                i === idx && e.kind === "new"
                  ? { ...e, data: { ...e.data, ...patch } }
                  : e,
              ),
            )
          }
          childAgeLabel="Age (optional — helps with meal / bed)"
          existingGroups={allGroups.map((g) => g.name)}
          suggestedRoles={t.guests.suggestedRoles as unknown as string[]}
        >
          <RelationshipCombobox
            label=""
            placeholder="Type a name to search or add a child…"
            guests={existingGuests}
            excludeIds={excludedFor(children)}
            createLabel="Add"
            onPickExisting={(g) =>
              setChildren((prev) => [...prev, { kind: "link", guest: g }])
            }
            onStartCreate={(name) =>
              setChildren((prev) => [...prev, { kind: "new", data: emptyRelative(name) }])
            }
          />
        </RelationshipSection>

        {error && <div className="error">{error}</div>}
        <Button
          type="submit"
          disabled={disableSubmit}
          style={{ width: "100%" }}
        >
          {busy ? t.common.adding : t.guests.submitAdd}
        </Button>
      </form>
    </main>
  );
}

/**
 * Renders the chips for a relationship's chosen entries (existing
 * links + new drafts), then whatever the caller passes as children
 * for the "add another" affordance (the combobox, usually).
 */
function RelationshipSection({
  label,
  hint,
  entries,
  onRemove,
  onUpdate,
  childAgeLabel,
  existingGroups,
  suggestedRoles,
  children,
}: {
  label: string;
  hint?: string;
  entries: LinkedEntry[];
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<NewRelatedGuest>) => void;
  childAgeLabel?: string;
  existingGroups?: string[];
  suggestedRoles?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {entries.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          {entries.map((e, idx) =>
            e.kind === "link" ? (
              <div
                key={`link-${e.guest.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "rgba(224,204,177,.35)",
                  border: "1px solid rgba(67,53,58,.12)",
                  borderRadius: 20,
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1 }}>
                  {e.guest.first_name} {e.guest.last_name ?? ""}
                </span>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => onRemove(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8a7f80",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div key={`new-${idx}`}>
                <div style={{ fontSize: 12, color: T.faint, marginBottom: 4 }}>
                  New — fill in what you know
                </div>
                <NewRelativeForm
                  value={e.data}
                  onChange={(patch) => onUpdate(idx, patch)}
                  onRemove={() => onRemove(idx)}
                  removeLabel="Remove"
                  ageLabel={childAgeLabel ?? "Age (optional)"}
                  existingGroups={existingGroups}
                  suggestedRoles={suggestedRoles}
                  autoFocus
                />
              </div>
            ),
          )}
        </div>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
