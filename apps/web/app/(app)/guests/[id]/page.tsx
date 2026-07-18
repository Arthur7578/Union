"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import {
  fetchGuest,
  updateGuest,
  deleteGuest,
  type GuestWithRsvp,
} from "@/lib/data";
import { Button, Card, SectionLabel, Loading, StatusPill } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

const STATUS_LABEL: Record<string, { text: string; tone: "green" | "amber" | "sand" }> = {
  attending: { text: "Attending", tone: "green" },
  declined: { text: "Can't make it", tone: "sand" },
  pending: { text: "Awaiting reply", tone: "amber" },
};

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [guest, setGuest] = useState<GuestWithRsvp | null | undefined>(undefined);

  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGuest(id)
      .then((g) => {
        setGuest(g);
        if (g) {
          setFirstNameV(g.first_name);
          setLastName(g.last_name ?? "");
          setEmail(g.email ?? "");
          setPartySize(String(g.party_size ?? 1));
          setGroup(g.guest_group ?? "");
        }
      })
      .catch(() => setGuest(null));
  }, [id]);

  if (guest === undefined) return <main className="u-main"><Loading /></main>;
  if (!guest)
    return (
      <main className="u-main">
        <BackHeader title="Guest not found" fallback="/guests" />
      </main>
    );

  const status = guest.rsvps?.status ?? "pending";
  const sl = STATUS_LABEL[status];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updateGuest(guest.id, {
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        party_size: Math.max(1, parseInt(partySize, 10) || 1),
        guest_group: group.trim() || null,
      });
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${guest.first_name} from your guest list?`)) return;
    setBusy(true);
    try {
      await deleteGuest(guest.id);
      router.replace("/guests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove.");
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/rsvp/${guest.invite_token}`
        : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={`${guest.first_name} ${guest.last_name ?? ""}`.trim()}
        subtitle={`Party of ${guest.party_size ?? 1}`}
        fallback="/guests"
        right={<StatusPill tone={sl.tone}>{sl.text}</StatusPill>}
      />

      {guest.rsvps && (guest.rsvps.dietary_notes || guest.rsvps.message) && (
        <Card style={{ marginBottom: 16 }}>
          {guest.rsvps.dietary_notes && (
            <div style={{ fontSize: 14, color: T.ink2 }}>
              <b>Dietary:</b> {guest.rsvps.dietary_notes}
            </div>
          )}
          {guest.rsvps.message && (
            <div style={{ fontSize: 14, color: T.ink2, marginTop: guest.rsvps.dietary_notes ? 8 : 0 }}>
              <b>Note:</b> {guest.rsvps.message}
            </div>
          )}
        </Card>
      )}

      <SectionLabel style={{ marginTop: 0 }}>Invitation link</SectionLabel>
      <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          /rsvp/{guest.invite_token}
        </div>
        <Button variant="secondary" onClick={copyLink} style={{ minHeight: 40, fontSize: 14 }}>
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </Card>

      <SectionLabel>Details</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="fn">First name</label>
          <input id="fn" type="text" required value={firstNameV} onChange={(e) => setFirstNameV(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ln">Last name</label>
          <input id="ln" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ps">Party size</label>
          <input id="ps" type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gr">Group</label>
          <input id="gr" type="text" value={group} onChange={(e) => setGroup(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <Button type="submit" disabled={busy || !firstNameV.trim()} style={{ width: "100%" }}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={remove} className="u-link" style={{ color: "#C0553B" }}>
            Remove guest
          </button>
        </div>
      </form>
    </main>
  );
}
