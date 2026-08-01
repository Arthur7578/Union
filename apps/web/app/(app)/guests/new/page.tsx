"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestGroup } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  addGuestGroup,
  createGuestWithLinks,
  fetchGuestGroups,
  fetchGuests,
  type GuestWithRsvp,
  type NewRelatedGuest,
} from "@/lib/data";
import { Button } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { GroupPicker, type GroupChip } from "@/components/GroupPicker";
import { NewRelativeForm } from "@/components/NewRelativeForm";
import { useT } from "@/lib/i18n/client";

const emptyRelative = (): NewRelatedGuest => ({
  first_name: "",
  last_name: null,
  email: null,
  phone: null,
  age_years: null,
  notes: null,
});

type PartnerChoice =
  | { mode: "none" }
  | { mode: "link"; id: string }
  | { mode: "create"; data: NewRelatedGuest };

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
  const [partner, setPartner] = useState<PartnerChoice>({ mode: "none" });
  const [linkParentIds, setLinkParentIds] = useState<string[]>([]);
  const [linkChildIds, setLinkChildIds] = useState<string[]>([]);
  const [newChildren, setNewChildren] = useState<NewRelatedGuest[]>([]);
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

  const hasAnyChild = linkChildIds.length > 0 || newChildren.length > 0;
  const showAgeField = linkParentIds.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const primary = selectedGroups[0] ?? null;
      const parsedAge = age.trim() === "" ? null : Math.max(0, Math.min(130, parseInt(age, 10)));
      // Create the primary guest atomically with any inline new
      // partner/children. Existing-guest links (parents, an existing
      // partner) also ride inside the same RPC. Linking pre-existing
      // children happens in a follow-up call because the primary's id
      // is only known after the RPC returns.
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
        parent_ids: linkParentIds,
        partner_id: partner.mode === "link" ? partner.id : null,
        new_partner: partner.mode === "create" ? partner.data : null,
        new_children: newChildren,
      });
      if (linkChildIds.length > 0) {
        const { addGuestRelationship } = await import("@/lib/data");
        for (const cid of linkChildIds) {
          await addGuestRelationship({
            wedding_id: wedding.id,
            from_guest: created.id,
            to_guest: cid,
            kind: "parent_of",
          });
        }
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

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(224,204,177,.35)",
    border: "1px solid rgba(67,53,58,.12)",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 13,
  };
  const xBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#8a7f80",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
  };

  const disableSubmit =
    busy ||
    !firstNameV.trim() ||
    (partner.mode === "create" && !partner.data.first_name.trim()) ||
    newChildren.some((c) => !c.first_name.trim());

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

        {/* Partner: link an existing guest OR create a new one inline. */}
        <div className="field">
          <label>Partner (optional)</label>
          {partner.mode === "create" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <NewRelativeForm
                value={partner.data}
                onChange={(patch) =>
                  setPartner({ mode: "create", data: { ...partner.data, ...patch } })
                }
                autoFocus
                onRemove={() => setPartner({ mode: "none" })}
                removeLabel="Cancel new partner"
              />
            </div>
          ) : partner.mode === "link" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(() => {
                const p = existingGuests.find((g) => g.id === partner.id);
                return (
                  <span style={chipStyle}>
                    {p ? `${p.first_name} ${p.last_name ?? ""}` : "(unknown)"}
                    <button
                      type="button"
                      aria-label="Unlink partner"
                      onClick={() => setPartner({ mode: "none" })}
                      style={xBtnStyle}
                    >
                      ×
                    </button>
                  </span>
                );
              })()}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {existingGuests.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setPartner({ mode: "link", id: v });
                  }}
                >
                  <option value="">— Link an existing guest —</option>
                  {existingGuests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name ?? ""}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() =>
                  setPartner({ mode: "create", data: emptyRelative() })
                }
                className="u-link"
                style={{ fontSize: 13, textAlign: "left" }}
              >
                + Add a new partner (with full details)
              </button>
            </div>
          )}
          <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
            Linked partners can register / edit each other from their invite.
          </div>
        </div>

        {/* Parents: chip picker linking existing guests only. */}
        {existingGuests.length > 0 && (
          <div className="field">
            <label htmlFor="lpar">Parents (optional)</label>
            {linkParentIds.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {linkParentIds.map((pid) => {
                  const p = existingGuests.find((g) => g.id === pid);
                  if (!p) return null;
                  return (
                    <span key={pid} style={chipStyle}>
                      {p.first_name} {p.last_name ?? ""}
                      <button
                        type="button"
                        aria-label="Remove parent"
                        onClick={() =>
                          setLinkParentIds((prev) => prev.filter((x) => x !== pid))
                        }
                        style={xBtnStyle}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              id="lpar"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setLinkParentIds((prev) =>
                  prev.includes(v) ? prev : [...prev, v],
                );
              }}
            >
              <option value="">— Add a parent —</option>
              {existingGuests
                .filter((g) => !linkParentIds.includes(g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
            </select>
            <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
              Pick each parent — e.g. mother, step-father. They can each
              manage this person from their own invite.
            </div>
          </div>
        )}

        {showAgeField && (
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
            <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
              Helps with meal / bed choices. Leave blank if unknown.
            </div>
          </div>
        )}

        {/* Children: link existing + create new inline. */}
        <div className="field">
          <label>Children (optional)</label>
          {(linkChildIds.length > 0 || newChildren.length > 0) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {linkChildIds.map((cid) => {
                const c = existingGuests.find((g) => g.id === cid);
                if (!c) return null;
                return (
                  <span key={cid} style={chipStyle}>
                    {c.first_name} {c.last_name ?? ""}
                    <button
                      type="button"
                      aria-label="Unlink child"
                      onClick={() =>
                        setLinkChildIds((prev) => prev.filter((x) => x !== cid))
                      }
                      style={xBtnStyle}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {newChildren.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
              {newChildren.map((child, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: 12, color: "#8a7f80", marginBottom: 4 }}>
                    New child #{idx + 1}
                  </div>
                  <NewRelativeForm
                    value={child}
                    onChange={(patch) =>
                      setNewChildren((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
                      )
                    }
                    onRemove={() =>
                      setNewChildren((prev) => prev.filter((_, i) => i !== idx))
                    }
                    removeLabel="Remove"
                    ageLabel="Age (optional — helps with meal / bed)"
                  />
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            {existingGuests.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setLinkChildIds((prev) =>
                    prev.includes(v) ? prev : [...prev, v],
                  );
                }}
              >
                <option value="">— Link an existing guest as a child —</option>
                {existingGuests
                  .filter((g) => !linkChildIds.includes(g.id))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name ?? ""}
                    </option>
                  ))}
              </select>
            )}
            <button
              type="button"
              onClick={() =>
                setNewChildren((prev) => [...prev, emptyRelative()])
              }
              className="u-link"
              style={{ fontSize: 13, textAlign: "left" }}
            >
              + Add a new child (with full details)
            </button>
          </div>
          {hasAnyChild && (
            <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
              This guest becomes each linked child's parent.
            </div>
          )}
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
