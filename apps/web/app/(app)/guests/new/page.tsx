"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWedding } from "@/lib/wedding";
import { addGuest, fetchGuestGroups } from "@/lib/data";
import { Button } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { useT } from "@/lib/i18n/client";

export default function NewGuestPage() {
  const t = useT();
  const { wedding } = useWedding();
  const router = useRouter();
  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    fetchGuestGroups(wedding.id)
      .then((gs) => setGroupOptions(gs.map((g) => g.name)))
      .catch(() => {});
  }, [wedding]);

  const options = useMemo(
    () => [...groupOptions].sort((a, b) => a.localeCompare(b)),
    [groupOptions],
  );

  if (!wedding) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await addGuest({
        wedding_id: wedding.id,
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        party_size: Math.max(1, parseInt(partySize, 10) || 1),
        guest_group: group.trim() || null,
        role: role.trim() || null,
        notes: notes.trim() || null,
      });
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.guests.errAdd);
      setBusy(false);
    }
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
        <div className="field">
          <label htmlFor="ps">{t.guests.fields.partySize}</label>
          <input
            id="ps"
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="gr">{t.guests.fields.group}</label>
          <input
            id="gr"
            type="text"
            list="gr-list"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder={t.guests.placeholders.group}
          />
          {options.length > 0 && (
            <datalist id="gr-list">
              {options.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
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
