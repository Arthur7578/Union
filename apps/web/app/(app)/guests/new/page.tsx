"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestGroup, GuestKind } from "@union/shared";
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
  const [kind, setKind] = useState<GuestKind>("adult");
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

  const adultGuests = existingGuests.filter((g) => g.kind === "adult");

  if (!wedding) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const primary = selectedGroups[0] ?? null;
      const guest = await addGuest({
        wedding_id: wedding.id,
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: kind === "adult" ? email.trim() || null : null,
        phone: kind === "adult" ? phone.trim() || null : null,
        kind,
        guest_group: primary?.name ?? null,
        role: role.trim() || null,
        notes: notes.trim() || null,
      });
      for (const g of selectedGroups.slice(1)) {
        await addGuestToGroup(guest.id, { id: g.id, name: g.name });
      }
      if (kind === "adult" && linkPartnerId) {
        await addGuestRelationship({
          wedding_id: wedding.id,
          from_guest: guest.id,
          to_guest: linkPartnerId,
          kind: "partner_of",
        });
      }
      if (kind === "child" && linkParentId) {
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
          <label>Guest kind</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(
              [
                ["adult", "Adult"],
                ["child", "Child"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border:
                    kind === k
                      ? "1px solid rgba(67,53,58,.35)"
                      : "1px solid rgba(67,53,58,.12)",
                  background: kind === k ? "rgba(224,204,177,.35)" : "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {kind === "adult" && (
          <>
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
            {adultGuests.length > 0 && (
              <div className="field">
                <label htmlFor="lp">Link as partner of (optional)</label>
                <select
                  id="lp"
                  value={linkPartnerId}
                  onChange={(e) => setLinkPartnerId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {adultGuests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name ?? ""}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
                  Linked partners can register / edit each other from their invite.
                </div>
              </div>
            )}
          </>
        )}
        {kind === "child" && adultGuests.length > 0 && (
          <div className="field">
            <label htmlFor="lpar">Parent (optional)</label>
            <select
              id="lpar"
              value={linkParentId}
              onChange={(e) => setLinkParentId(e.target.value)}
            >
              <option value="">— None —</option>
              {adultGuests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.first_name} {g.last_name ?? ""}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "#8a7f80", marginTop: 4 }}>
              The parent can manage this child from their own invite.
            </div>
          </div>
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
