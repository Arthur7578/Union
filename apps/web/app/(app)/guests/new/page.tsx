"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestGroup } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  addGuest,
  addGuestGroup,
  addGuestRelationship,
  addGuestToGroup,
  fetchGuestGroups,
  fetchGuests,
  type GuestWithRsvp,
} from "@/lib/data";
import { Button } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { GroupPicker, type GroupChip } from "@/components/GroupPicker";
import { useT } from "@/lib/i18n/client";

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
  const [linkPartnerId, setLinkPartnerId] = useState<string>("");
  const [linkParentId, setLinkParentId] = useState<string>("");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const primary = selectedGroups[0] ?? null;
      const parsedAge = age.trim() === "" ? null : Math.max(0, Math.min(130, parseInt(age, 10)));
      const guest = await addGuest({
        wedding_id: wedding.id,
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        age_years: Number.isFinite(parsedAge as number) ? parsedAge : null,
        guest_group: primary?.name ?? null,
        role: role.trim() || null,
        notes: notes.trim() || null,
      });
      for (const g of selectedGroups.slice(1)) {
        await addGuestToGroup(guest.id, { id: g.id, name: g.name });
      }
      if (linkPartnerId) {
        await addGuestRelationship({
          wedding_id: wedding.id,
          from_guest: guest.id,
          to_guest: linkPartnerId,
          kind: "partner_of",
        });
      }
      if (linkParentId) {
        await addGuestRelationship({
          wedding_id: wedding.id,
          from_guest: linkParentId,
          to_guest: guest.id,
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
        {existingGuests.length > 0 && (
          <>
            <div className="field">
              <label htmlFor="lp">Link as partner of (optional)</label>
              <select
                id="lp"
                value={linkPartnerId}
                onChange={(e) => setLinkPartnerId(e.target.value)}
              >
                <option value="">— None —</option>
                {existingGuests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
                Linked partners can register / edit each other from their invite.
              </div>
            </div>
            <div className="field">
              <label htmlFor="lpar">Parent (optional)</label>
              <select
                id="lpar"
                value={linkParentId}
                onChange={(e) => setLinkParentId(e.target.value)}
              >
                <option value="">— None —</option>
                {existingGuests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
                The parent can manage this person from their own invite.
              </div>
            </div>
            {linkParentId && (
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
          </>
        )}
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
          disabled={busy || !firstNameV.trim()}
          style={{ width: "100%" }}
        >
          {busy ? t.common.adding : t.guests.submitAdd}
        </Button>
      </form>
    </main>
  );
}
