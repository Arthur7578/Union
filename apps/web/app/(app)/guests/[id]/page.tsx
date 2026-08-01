"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import type { GuestGroup, RoomBlock, RsvpStatus, SeatingTable } from "@union/shared";
import {
  addGuestGroup,
  addGuestRelationship,
  addGuestToGroup,
  clearRsvp,
  createGuestWithLinks,
  deleteGuest,
  fetchGuest,
  fetchGuestGroups,
  fetchGuestLinks,
  fetchGuests,
  fetchRoomBlocks,
  fetchSeatingTables,
  removeGuestFromGroup,
  removeGuestRelationship,
  updateGuest,
  upsertRsvp,
  type GuestLink,
  type GuestWithRsvp,
  type NewRelatedGuest,
} from "@/lib/data";
import { useWedding } from "@/lib/wedding";
import { Button, Card, SectionLabel, Loading, StatusPill } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { GroupPicker, type GroupChip } from "@/components/GroupPicker";
import { MergeReviewPanel } from "@/components/MergeReviewPanel";
import { NewRelativeForm } from "@/components/NewRelativeForm";

const STATUS_LABEL: Record<
  string,
  { text: string; tone: "green" | "amber" | "sand" }
> = {
  attending: { text: "Attending", tone: "green" },
  declined: { text: "Can't make it", tone: "sand" },
  pending: { text: "Awaiting reply", tone: "amber" },
};

const SUGGESTED_ROLES = [
  "Maid of honor",
  "Best man",
  "Bridesmaid",
  "Groomsman",
  "Officiant",
  "Ring bearer",
  "Flower girl",
  "Witness",
];

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { wedding } = useWedding();
  const [guest, setGuest] = useState<GuestWithRsvp | null | undefined>(undefined);

  const [firstNameV, setFirstNameV] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<string>("");
  const [canAddPartner, setCanAddPartner] = useState<"inherit" | "yes" | "no">("inherit");
  const [canAddKids, setCanAddKids] = useState<"inherit" | "yes" | "no">("inherit");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [roomBlockId, setRoomBlockId] = useState<string>("");
  const [seatingTableId, setSeatingTableId] = useState<string>("");

  // Relationships
  const [links, setLinks] = useState<GuestLink[]>([]);
  const [otherGuests, setOtherGuests] = useState<GuestWithRsvp[]>([]);
  const [linksBusy, setLinksBusy] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  // Inline age edit (chip near header).
  const [editingAge, setEditingAge] = useState(false);
  const [ageDraft, setAgeDraft] = useState<string>("");
  const [ageBusy, setAgeBusy] = useState(false);

  // Inline "add a child" / "add a partner" mini-forms — each creates
  // a new guest row with full details and wires the relationship in
  // a single RPC call.
  const emptyRelative = (): NewRelatedGuest => ({
    first_name: "",
    last_name: null,
    email: null,
    phone: null,
    age_years: null,
    notes: null,
  });
  const [addChildDraft, setAddChildDraft] = useState<NewRelatedGuest | null>(null);
  const [addChildBusy, setAddChildBusy] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);
  const [addPartnerDraft, setAddPartnerDraft] = useState<NewRelatedGuest | null>(null);
  const [addPartnerBusy, setAddPartnerBusy] = useState(false);
  const [addPartnerError, setAddPartnerError] = useState<string | null>(null);

  // Voluntary merge: pick another guest to fold into this one, then
  // resolve any field conflicts via the shared review panel.
  const [mergePickId, setMergePickId] = useState<string>("");
  const [mergeReviewing, setMergeReviewing] = useState(false);

  // RSVP recording form (owner side).
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | "">("");
  const [rsvpDiet, setRsvpDiet] = useState("");
  const [rsvpMessage, setRsvpMessage] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpNote, setRsvpNote] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allGroups, setAllGroups] = useState<GuestGroup[]>([]);
  const [rooms, setRooms] = useState<RoomBlock[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchGuest(id)
      .then((g) => {
        setGuest(g);
        if (g) {
          setFirstNameV(g.first_name);
          setLastName(g.last_name ?? "");
          setEmail(g.email ?? "");
          setPhone(g.phone ?? "");
          setAge(g.age_years != null ? String(g.age_years) : "");
          setCanAddPartner(g.can_add_partner == null ? "inherit" : g.can_add_partner ? "yes" : "no");
          setCanAddKids(g.can_add_kids == null ? "inherit" : g.can_add_kids ? "yes" : "no");
          setRole(g.role ?? "");
          setNotes(g.notes ?? "");
          setRoomBlockId(g.room_block_id ?? "");
          setSeatingTableId(g.seating_table_id ?? "");
          if (g.rsvps) {
            setRsvpStatus(g.rsvps.status);
            setRsvpDiet(g.rsvps.dietary_notes ?? "");
            setRsvpMessage(g.rsvps.message ?? "");
          }
        }
      })
      .catch(() => setGuest(null));
    fetchGuestLinks(id)
      .then((l) => {
        setLinks(l);
        setLinksError(null);
      })
      .catch((e) => {
        setLinksError(e instanceof Error ? e.message : "Couldn't load links.");
      });
  }, [id]);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    Promise.all([
      fetchGuestGroups(wedding.id),
      fetchRoomBlocks(wedding.id),
      fetchSeatingTables(wedding.id),
      fetchGuests(wedding.id),
    ])
      .then(([gs, rb, st, allGuests]) => {
        if (!ok) return;
        setAllGroups(gs);
        setRooms(rb);
        setTables(st);
        setOtherGuests(allGuests.filter((x) => x.id !== id));
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [wedding, id]);

  const currentGroups: GroupChip[] = (guest?.groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
  }));

  if (guest === undefined)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );
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
      // Groups are managed live via toggleGroup below; save() covers the
      // rest of the guest record. guest_group (the primary text label) is
      // maintained automatically by the group helpers.
      const parsedAge = age.trim() === "" ? null : Math.max(0, Math.min(130, parseInt(age, 10)));
      const updated = await updateGuest(guest.id, {
        first_name: firstNameV.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        age_years: Number.isFinite(parsedAge as number) ? parsedAge : null,
        can_add_partner:
          canAddPartner === "inherit" ? null : canAddPartner === "yes",
        can_add_kids:
          canAddKids === "inherit" ? null : canAddKids === "yes",
        role: role.trim() || null,
        notes: notes.trim() || null,
        room_block_id: roomBlockId || null,
        seating_table_id: seatingTableId || null,
      });
      setGuest((prev) => (prev ? { ...prev, ...updated } : prev));
      setBusy(false);
      setError(null);
      setRsvpNote("Saved.");
      setTimeout(() => setRsvpNote(null), 1800);
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

  const emailInvite = () => {
    if (!guest.email) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const partners = [wedding?.partner_one, wedding?.partner_two]
      .filter(Boolean)
      .join(" & ") || "us";
    const url = `${origin}/rsvp/${guest.invite_token}`;
    const subject = `You're invited — RSVP for ${partners}`;
    const body = `Hi ${guest.first_name},\n\nWe'd love for you to celebrate with us. Your RSVP link:\n${url}\n\nWith love,\n${partners}`;
    window.location.href = `mailto:${encodeURIComponent(guest.email)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  const saveRsvp = async () => {
    if (!rsvpStatus) return;
    setRsvpBusy(true);
    setRsvpNote(null);
    try {
      const saved = await upsertRsvp({
        guest_id: guest.id,
        status: rsvpStatus as RsvpStatus,
        dietary_notes: rsvpDiet.trim() || null,
        message: rsvpMessage.trim() || null,
      });
      setGuest((prev) => (prev ? { ...prev, rsvps: saved } : prev));
      setRsvpNote("RSVP recorded.");
    } catch (err) {
      setRsvpNote(err instanceof Error ? err.message : "Couldn't record RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  };

  const clearRsvpRow = async () => {
    setRsvpBusy(true);
    setRsvpNote(null);
    try {
      await clearRsvp(guest.id);
      setGuest((prev) => (prev ? { ...prev, rsvps: null } : prev));
      setRsvpStatus("");
      setRsvpDiet("");
      setRsvpMessage("");
      setRsvpNote("RSVP cleared.");
    } catch (err) {
      setRsvpNote(err instanceof Error ? err.message : "Couldn't clear RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  };

  const refreshLinks = async () => {
    const l = await fetchGuestLinks(guest.id);
    setLinks(l);
    setLinksError(null);
  };

  const addPartnerLink = async (otherId: string) => {
    if (!wedding) return;
    setLinksBusy(true);
    setLinksError(null);
    try {
      await addGuestRelationship({
        wedding_id: wedding.id,
        from_guest: guest.id,
        to_guest: otherId,
        kind: "partner_of",
      });
      await refreshLinks();
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Couldn't link partner.");
    } finally {
      setLinksBusy(false);
    }
  };

  const addKidLink = async (otherId: string) => {
    if (!wedding) return;
    setLinksBusy(true);
    setLinksError(null);
    try {
      await addGuestRelationship({
        wedding_id: wedding.id,
        from_guest: guest.id,
        to_guest: otherId,
        kind: "parent_of",
      });
      await refreshLinks();
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Couldn't link child.");
    } finally {
      setLinksBusy(false);
    }
  };

  const addParentLink = async (otherId: string) => {
    if (!wedding) return;
    setLinksBusy(true);
    setLinksError(null);
    try {
      await addGuestRelationship({
        wedding_id: wedding.id,
        from_guest: otherId,
        to_guest: guest.id,
        kind: "parent_of",
      });
      await refreshLinks();
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Couldn't link parent.");
    } finally {
      setLinksBusy(false);
    }
  };

  const saveAge = async () => {
    setAgeBusy(true);
    try {
      const parsed =
        ageDraft.trim() === ""
          ? null
          : Math.max(0, Math.min(130, parseInt(ageDraft, 10)));
      const finalAge = Number.isFinite(parsed as number) ? parsed : null;
      const updated = await updateGuest(guest.id, { age_years: finalAge });
      setGuest((prev) => (prev ? { ...prev, ...updated } : prev));
      setAge(finalAge != null ? String(finalAge) : "");
      setEditingAge(false);
    } finally {
      setAgeBusy(false);
    }
  };

  const addChildGuest = async () => {
    if (!wedding || !addChildDraft || !addChildDraft.first_name.trim()) return;
    setAddChildBusy(true);
    setAddChildError(null);
    try {
      // Same atomic path as the add-guest form: create the child +
      // parent_of edge in one server transaction.
      await createGuestWithLinks({
        wedding_id: wedding.id,
        first_name: addChildDraft.first_name.trim(),
        last_name: addChildDraft.last_name ?? null,
        email: addChildDraft.email ?? null,
        phone: addChildDraft.phone ?? null,
        age_years: addChildDraft.age_years ?? null,
        notes: addChildDraft.notes ?? null,
        parent_ids: [guest.id],
      });
      await refreshLinks();
      const refreshedOthers = await fetchGuests(wedding.id);
      setOtherGuests(refreshedOthers.filter((x) => x.id !== guest.id));
      setAddChildDraft(null);
    } catch (e) {
      setAddChildError(e instanceof Error ? e.message : "Couldn't add child.");
    } finally {
      setAddChildBusy(false);
    }
  };

  const addPartnerGuest = async () => {
    if (!wedding || !addPartnerDraft || !addPartnerDraft.first_name.trim()) return;
    setAddPartnerBusy(true);
    setAddPartnerError(null);
    try {
      await createGuestWithLinks({
        wedding_id: wedding.id,
        first_name: addPartnerDraft.first_name.trim(),
        last_name: addPartnerDraft.last_name ?? null,
        email: addPartnerDraft.email ?? null,
        phone: addPartnerDraft.phone ?? null,
        age_years: addPartnerDraft.age_years ?? null,
        notes: addPartnerDraft.notes ?? null,
        partner_id: guest.id,
      });
      await refreshLinks();
      const refreshedOthers = await fetchGuests(wedding.id);
      setOtherGuests(refreshedOthers.filter((x) => x.id !== guest.id));
      setAddPartnerDraft(null);
    } catch (e) {
      setAddPartnerError(e instanceof Error ? e.message : "Couldn't add partner.");
    } finally {
      setAddPartnerBusy(false);
    }
  };

  const removeLink = async (link: GuestLink) => {
    setLinksBusy(true);
    setLinksError(null);
    try {
      const from = link.direction === "outgoing" ? guest.id : link.guest.id;
      const to = link.direction === "outgoing" ? link.guest.id : guest.id;
      await removeGuestRelationship({
        from_guest: from,
        to_guest: to,
        kind: link.kind,
      });
      await refreshLinks();
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Couldn't remove link.");
    } finally {
      setLinksBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={`${guest.first_name} ${guest.last_name ?? ""}`.trim()}
        subtitle=""
        fallback="/guests"
        right={<StatusPill tone={sl.tone}>{sl.text}</StatusPill>}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 12.5,
          color: T.faint,
        }}
      >
        {editingAge ? (
          <>
            <label htmlFor="age-inline" style={{ margin: 0 }}>Age</label>
            <input
              id="age-inline"
              type="number"
              min={0}
              max={130}
              value={ageDraft}
              onChange={(e) => setAgeDraft(e.target.value)}
              onBlur={() => void saveAge()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveAge();
                } else if (e.key === "Escape") {
                  setEditingAge(false);
                }
              }}
              disabled={ageBusy}
              autoFocus
              style={{ width: 72 }}
            />
          </>
        ) : guest.age_years != null ? (
          <>
            <span>{guest.age_years} years old</span>
            <button
              type="button"
              onClick={() => {
                setAgeDraft(String(guest.age_years ?? ""));
                setEditingAge(true);
              }}
              className="u-link"
              style={{ fontSize: 12, color: T.muted2 }}
            >
              edit
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAgeDraft("");
              setEditingAge(true);
            }}
            className="u-link"
            style={{ fontSize: 12, color: T.muted2 }}
          >
            + Add age (only if it affects meal or bed)
          </button>
        )}
      </div>

      {guest.rsvps && (guest.rsvps.dietary_notes || guest.rsvps.message) && (
        <Card style={{ marginBottom: 16 }}>
          {guest.rsvps.dietary_notes && (
            <div style={{ fontSize: 14, color: T.ink2 }}>
              <b>Dietary:</b> {guest.rsvps.dietary_notes}
            </div>
          )}
          {guest.rsvps.message && (
            <div
              style={{
                fontSize: 14,
                color: T.ink2,
                marginTop: guest.rsvps.dietary_notes ? 8 : 0,
              }}
            >
              <b>Note:</b> {guest.rsvps.message}
            </div>
          )}
        </Card>
      )}

      <SectionLabel style={{ marginTop: 0 }}>Invitation link</SectionLabel>
      <Card style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 140,
            fontSize: 13,
            color: T.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          /rsvp/{guest.invite_token}
        </div>
        <Button
          variant="secondary"
          onClick={copyLink}
          style={{ minHeight: 38, fontSize: 13 }}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
        {guest.email && (
          <Button
            onClick={emailInvite}
            style={{ minHeight: 38, fontSize: 13 }}
          >
            Email invite
          </Button>
        )}
      </Card>
      {guest.rsvp_reminder_sent_at && (
        <div
          style={{
            fontSize: 12,
            color: T.faint,
            marginTop: 6,
            padding: "0 4px",
          }}
        >
          Last reminder sent {new Date(guest.rsvp_reminder_sent_at).toLocaleDateString()}
        </div>
      )}

      <SectionLabel>RSVP</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>
          Record what {guest.first_name} told you — this counts toward your
          headcount immediately.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              ["attending", "Attending"],
              ["declined", "Can't make it"],
            ] as const
          ).map(([k, label]) => {
            const on = rsvpStatus === k;
            return (
              <button
                key={k}
                onClick={() => setRsvpStatus(k)}
                type="button"
                style={{
                  border: `1px solid ${on ? T.accentBorder : "rgba(67,53,58,.1)"}`,
                  background: on ? T.accentSoft : "#fff",
                  color: on ? T.ink : T.muted2,
                  padding: "7px 13px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(rsvpStatus === "attending" || rsvpStatus === "declined") && (
          <>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="rd">Dietary or access notes</label>
              <input
                id="rd"
                type="text"
                value={rsvpDiet}
                onChange={(e) => setRsvpDiet(e.target.value)}
                placeholder="Vegetarian, gluten-free…"
              />
            </div>
            <div className="field">
              <label htmlFor="rm">A note from them</label>
              <input
                id="rm"
                type="text"
                value={rsvpMessage}
                onChange={(e) => setRsvpMessage(e.target.value)}
                placeholder="Can't wait!"
              />
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <Button
            onClick={saveRsvp}
            disabled={rsvpBusy || !rsvpStatus || rsvpStatus === "pending"}
            style={{ flex: 1, minWidth: 140 }}
          >
            {rsvpBusy ? "Saving…" : "Record RSVP"}
          </Button>
          {guest.rsvps && (
            <Button
              variant="secondary"
              onClick={clearRsvpRow}
              disabled={rsvpBusy}
              style={{ minWidth: 100 }}
            >
              Clear
            </Button>
          )}
        </div>
        {rsvpNote && (
          <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>
            {rsvpNote}
          </div>
        )}
      </Card>

      <SectionLabel>Relationships</SectionLabel>
      <Card>
        {linksError && (
          <div
            className="error"
            style={{ fontSize: 12.5, marginBottom: 10 }}
          >
            {linksError}
          </div>
        )}
        {links.length === 0 && !linksError && (
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
            No linked guests yet.
          </div>
        )}
        {links.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {links.map((l) => {
              const label =
                l.kind === "partner_of"
                  ? "partner"
                  : l.direction === "outgoing"
                    ? "child"
                    : "parent";
              return (
                <span
                  key={`${l.direction}-${l.kind}-${l.guest.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(224,204,177,.35)",
                    border: "1px solid rgba(67,53,58,.12)",
                    borderRadius: 20,
                    padding: "5px 10px",
                    fontSize: 13,
                  }}
                >
                  <b>{label}:</b>{" "}
                  <a
                    href={`/guests/${l.guest.id}`}
                    style={{ color: T.ink, textDecoration: "none" }}
                  >
                    {l.guest.first_name} {l.guest.last_name ?? ""}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeLink(l)}
                    disabled={linksBusy}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 13, color: T.muted }}>
            Link as partner
            <select
              onChange={(e) => {
                if (e.target.value) {
                  void addPartnerLink(e.target.value);
                  e.currentTarget.value = "";
                }
              }}
              disabled={linksBusy}
              defaultValue=""
              style={{ marginTop: 4 }}
            >
              <option value="">— Choose a guest —</option>
              {otherGuests
                .filter((g) => !links.some((l) => l.kind === "partner_of" && l.guest.id === g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
            </select>
          </label>
          <label style={{ fontSize: 13, color: T.muted }}>
            Add as parent of
            <select
              onChange={(e) => {
                if (e.target.value) {
                  void addKidLink(e.target.value);
                  e.currentTarget.value = "";
                }
              }}
              disabled={linksBusy}
              defaultValue=""
              style={{ marginTop: 4 }}
            >
              <option value="">— Choose a guest —</option>
              {otherGuests
                .filter(
                  (g) =>
                    !links.some(
                      (l) =>
                        l.kind === "parent_of" &&
                        l.direction === "outgoing" &&
                        l.guest.id === g.id,
                    ),
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
            </select>
          </label>
          <label style={{ fontSize: 13, color: T.muted }}>
            Link a parent
            <select
              onChange={(e) => {
                if (e.target.value) {
                  void addParentLink(e.target.value);
                  e.currentTarget.value = "";
                }
              }}
              disabled={linksBusy}
              defaultValue=""
              style={{ marginTop: 4 }}
            >
              <option value="">— Choose a guest —</option>
              {otherGuests
                .filter(
                  (g) =>
                    !links.some(
                      (l) =>
                        l.kind === "parent_of" &&
                        l.direction === "incoming" &&
                        l.guest.id === g.id,
                    ),
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${T.line}`,
            display: "grid",
            gap: 12,
          }}
        >
          {addPartnerDraft ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Add a partner (new guest, linked to {guest.first_name})
              </div>
              <NewRelativeForm
                value={addPartnerDraft}
                onChange={(patch) =>
                  setAddPartnerDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                }
                autoFocus
              />
              {addPartnerError && (
                <div className="error" style={{ fontSize: 12 }}>
                  {addPartnerError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  onClick={() => void addPartnerGuest()}
                  disabled={addPartnerBusy || !addPartnerDraft.first_name.trim()}
                  style={{ flex: 1 }}
                >
                  {addPartnerBusy ? "Adding…" : "Add partner"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddPartnerDraft(null);
                    setAddPartnerError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddPartnerDraft(emptyRelative())}
              className="u-link"
              style={{ fontSize: 13, color: T.ink2, textAlign: "left" }}
            >
              + Add a new partner (with full details)
            </button>
          )}

          {addChildDraft ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Add a child (new guest, linked to {guest.first_name})
              </div>
              <NewRelativeForm
                value={addChildDraft}
                onChange={(patch) =>
                  setAddChildDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                }
                autoFocus
                ageLabel="Age (optional — helps with meal / bed)"
              />
              {addChildError && (
                <div className="error" style={{ fontSize: 12 }}>
                  {addChildError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  onClick={() => void addChildGuest()}
                  disabled={addChildBusy || !addChildDraft.first_name.trim()}
                  style={{ flex: 1 }}
                >
                  {addChildBusy ? "Adding…" : "Add child"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddChildDraft(null);
                    setAddChildError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddChildDraft(emptyRelative())}
              className="u-link"
              style={{ fontSize: 13, color: T.ink2, textAlign: "left" }}
            >
              + Add a new child (with full details)
            </button>
          )}
        </div>
      </Card>

      <SectionLabel>Merge with another guest</SectionLabel>
      <Card>
        {mergeReviewing && mergePickId ? (
          (() => {
            const other = otherGuests.find((g) => g.id === mergePickId);
            if (!other) {
              return (
                <div style={{ fontSize: 13, color: T.muted }}>
                  Couldn't find that guest anymore. Try again.
                </div>
              );
            }
            return (
              <MergeReviewPanel
                guests={[guest, other]}
                onDone={(survivingId) => {
                  setMergeReviewing(false);
                  setMergePickId("");
                  // The surviving id might be the other guest —
                  // navigate there so we don't render a stale, now-
                  // deleted, current guest.
                  router.replace(`/guests/${survivingId}`);
                }}
                onCancel={() => {
                  setMergeReviewing(false);
                }}
              />
            );
          })()
        ) : (
          <>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
              Fold this guest together with another one — useful when the
              auto-detector didn't catch a duplicate (different spelling,
              nickname, etc.). You'll get to resolve any conflicting field
              before it goes through.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={mergePickId}
                onChange={(e) => setMergePickId(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              >
                <option value="">— Pick another guest —</option>
                {otherGuests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name ?? ""}
                    {g.email ? ` · ${g.email}` : ""}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => setMergeReviewing(true)}
                disabled={!mergePickId}
                style={{ minHeight: 38, fontSize: 13 }}
              >
                Review merge
              </Button>
            </div>
          </>
        )}
      </Card>

      <SectionLabel>Details</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="fn">First name</label>
          <input
            id="fn"
            type="text"
            required
            value={firstNameV}
            onChange={(e) => setFirstNameV(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ln">Last name</label>
          <input
            id="ln"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="em">Email</label>
          <input
            id="em"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ph">Phone</label>
          <input
            id="ph"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Can add a partner from their RSVP</label>
          <select
            value={canAddPartner}
            onChange={(e) =>
              setCanAddPartner(e.target.value as "inherit" | "yes" | "no")
            }
          >
            <option value="inherit">Inherit wedding default</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="field">
          <label>Can add children from their RSVP</label>
          <select
            value={canAddKids}
            onChange={(e) =>
              setCanAddKids(e.target.value as "inherit" | "yes" | "no")
            }
          >
            <option value="inherit">Inherit wedding default</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="field">
          <label>Groups</label>
          <GroupPicker
            allGroups={allGroups}
            selected={currentGroups}
            onSelect={async (g) => {
              await addGuestToGroup(guest.id, { id: g.id, name: g.name });
              const refreshed = await fetchGuest(guest.id);
              if (refreshed) setGuest(refreshed);
            }}
            onDeselect={async (g) => {
              await removeGuestFromGroup(guest.id, { id: g.id, name: g.name });
              const refreshed = await fetchGuest(guest.id);
              if (refreshed) setGuest(refreshed);
            }}
            onCreate={async (name) => {
              if (!wedding) throw new Error("No wedding loaded");
              const created = await addGuestGroup({
                wedding_id: wedding.id,
                name,
              });
              setAllGroups((prev) => [...prev, created]);
              return {
                id: created.id,
                name: created.name,
                color: created.color,
              };
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="rl">Role in the wedding</label>
          <input
            id="rl"
            type="text"
            list="rl-list"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Maid of honor, officiant…"
          />
          <datalist id="rl-list">
            {SUGGESTED_ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        {rooms.length > 0 && (
          <div className="field">
            <label htmlFor="rb">Room block</label>
            <select
              id="rb"
              value={roomBlockId}
              onChange={(e) => setRoomBlockId(e.target.value)}
            >
              <option value="">— None —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tables.length > 0 && (
          <div className="field">
            <label htmlFor="st">Seating table</label>
            <select
              id="st"
              value={seatingTableId}
              onChange={(e) => setSeatingTableId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="nt">Notes (private to you)</label>
          <textarea
            id="nt"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Plus-one confirmed on the phone, allergic to shellfish, etc."
            rows={3}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <Button
          type="submit"
          disabled={busy || !firstNameV.trim()}
          style={{ width: "100%" }}
        >
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={remove}
            className="u-link"
            style={{ color: "#C0553B" }}
          >
            Remove guest
          </button>
        </div>
      </form>
    </main>
  );
}
