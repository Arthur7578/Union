"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWedding } from "@/lib/wedding";
import { addGuest } from "@/lib/data";
import { Button } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

export default function NewGuestPage() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        party_size: Math.max(1, parseInt(partySize, 10) || 1),
        guest_group: group.trim() || null,
      });
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader title="Add a guest" subtitle="They'll be added to your list" fallback="/guests" />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="fn">First name</label>
          <input id="fn" type="text" required value={firstNameV} onChange={(e) => setFirstNameV(e.target.value)} placeholder="Priya" />
        </div>
        <div className="field">
          <label htmlFor="ln">Last name</label>
          <input id="ln" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Shah" />
        </div>
        <div className="field">
          <label htmlFor="em">Email (for their invite)</label>
          <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
        </div>
        <div className="field">
          <label htmlFor="ps">Party size</label>
          <input id="ps" type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gr">Group (optional)</label>
          <input id="gr" type="text" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="College friends" />
        </div>
        {error && <div className="error">{error}</div>}
        <Button type="submit" disabled={busy || !firstNameV.trim()} style={{ width: "100%" }}>
          {busy ? "Adding…" : "Add guest"}
        </Button>
      </form>
    </main>
  );
}
