"use client";

import { getBrowserSupabase } from "./supabaseClient";
import type {
  Guest,
  GuestGroup,
  GuestRelationship,
  GuestRelationshipKind,
  RoomBlock,
  Rsvp,
  RsvpQuestion,
  RsvpStatus,
  SeatingTable,
  Wedding,
} from "@union/shared";

/** Lightweight group view attached to a guest row. */
export type GuestGroupRef = { id: string; name: string; color: string | null };

/**
 * A guest row joined with its (optional) rsvp AND the full set of groups it
 * belongs to. `guests.guest_group` (text) is kept as the *primary* group so
 * legacy screens keep rendering; `groups` is the multi-membership union
 * (primary + any additional memberships from guest_group_members).
 */
export type GuestWithRsvp = Guest & {
  rsvps: Rsvp | null;
  groups: GuestGroupRef[];
};

export async function fetchWedding(ownerId: string): Promise<Wedding | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("weddings")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createWedding(
  input: Omit<
    Wedding,
    | "id"
    | "created_at"
    | "rsvp_form_questions"
    | "ceremony_rows"
    | "ceremony_reserved_rows"
    | "allow_guests_add_partner"
    | "allow_guests_add_children"
    | "max_children_per_guest"
    | "guest_count_target"
    | "style_vibe"
  > & {
    rsvp_form_questions?: Wedding["rsvp_form_questions"];
    ceremony_rows?: number;
    ceremony_reserved_rows?: number;
    allow_guests_add_partner?: boolean;
    allow_guests_add_children?: boolean;
    max_children_per_guest?: number | null;
    guest_count_target?: number | null;
    style_vibe?: string | null;
  },
): Promise<Wedding> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("weddings")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateWedding(
  id: string,
  patch: Partial<Omit<Wedding, "id" | "owner_id" | "created_at">>,
): Promise<Wedding> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("weddings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Union the primary text group with join-table memberships into one array. */
function unionGroups(
  primaryName: string | null | undefined,
  members: Array<{ guest_groups: GuestGroupRef | null } | null> | null | undefined,
  allGroups: GuestGroup[],
): GuestGroupRef[] {
  const byName = new Map<string, GuestGroupRef>();
  for (const m of members ?? []) {
    const gg = m?.guest_groups;
    if (gg?.id) byName.set(gg.name, gg);
  }
  if (primaryName && !byName.has(primaryName)) {
    const hit = allGroups.find((g) => g.name === primaryName);
    byName.set(primaryName, {
      id: hit?.id ?? primaryName,
      name: primaryName,
      color: hit?.color ?? null,
    });
  }
  return Array.from(byName.values());
}

export async function fetchGuests(weddingId: string): Promise<GuestWithRsvp[]> {
  const supabase = getBrowserSupabase();
  // Fetch guests + rsvps + memberships and groups in one round-trip.
  const [guestsRes, groupsRes] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "*, rsvps(*), guest_group_members(guest_groups(id, name, color))",
      )
      .eq("wedding_id", weddingId)
      .order("created_at", { ascending: true }),
    supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
  ]);
  if (guestsRes.error) throw guestsRes.error;
  if (groupsRes.error) throw groupsRes.error;
  const allGroups = (groupsRes.data ?? []) as GuestGroup[];
  return (guestsRes.data ?? []).map((g: any) => ({
    ...g,
    rsvps: Array.isArray(g.rsvps) ? (g.rsvps[0] ?? null) : (g.rsvps ?? null),
    groups: unionGroups(g.guest_group, g.guest_group_members, allGroups),
  })) as GuestWithRsvp[];
}

export async function fetchGuest(id: string): Promise<GuestWithRsvp | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .select(
      "*, rsvps(*), guest_group_members(guest_groups(id, name, color))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Load parent wedding's groups so we can fill in colours for the primary.
  const { data: groups } = await supabase
    .from("guest_groups")
    .select("*")
    .eq("wedding_id", (data as any).wedding_id);
  return {
    ...(data as any),
    rsvps: Array.isArray((data as any).rsvps)
      ? ((data as any).rsvps[0] ?? null)
      : ((data as any).rsvps ?? null),
    groups: unionGroups(
      (data as any).guest_group,
      (data as any).guest_group_members,
      (groups ?? []) as GuestGroup[],
    ),
  } as GuestWithRsvp;
}

export type NewGuest = {
  wedding_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  age_years?: number | null;
  can_add_partner?: boolean | null;
  can_add_kids?: boolean | null;
  added_by_guest_id?: string | null;
  guest_group?: string | null;
  role?: string | null;
  notes?: string | null;
  room_block_id?: string | null;
  seating_table_id?: string | null;
  ceremony_row?: number | null;
  ceremony_side?: "left" | "right" | null;
};

/**
 * When a primary text group is supplied, make sure a matching guest_groups
 * row exists and add a membership so multi-group screens stay consistent.
 */
async function ensurePrimaryMembership(
  supabase: ReturnType<typeof getBrowserSupabase>,
  guestId: string,
  weddingId: string,
  primaryName: string | null | undefined,
): Promise<void> {
  if (!primaryName) return;
  const trimmed = primaryName.trim();
  if (!trimmed) return;
  const { data: existing } = await supabase
    .from("guest_groups")
    .select("id")
    .eq("wedding_id", weddingId)
    .eq("name", trimmed)
    .maybeSingle();
  let groupId = existing?.id;
  if (!groupId) {
    const { data: created } = await supabase
      .from("guest_groups")
      .insert({ wedding_id: weddingId, name: trimmed })
      .select("id")
      .single();
    groupId = created?.id;
  }
  if (!groupId) return;
  const ins = await supabase
    .from("guest_group_members")
    .insert({ guest_id: guestId, group_id: groupId });
  if (ins.error && (ins.error as { code?: string }).code !== "23505") {
    throw ins.error;
  }
}

export async function addGuest(input: NewGuest): Promise<Guest> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  await ensurePrimaryMembership(
    supabase,
    data.id,
    input.wedding_id,
    input.guest_group,
  );
  return data;
}

export async function updateGuest(
  id: string,
  patch: Partial<NewGuest>,
): Promise<Guest> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  // If the primary text col changed, mirror it into the join table so the
  // Groups screen keeps the guest listed under the new label.
  if (
    Object.prototype.hasOwnProperty.call(patch, "guest_group") &&
    patch.guest_group
  ) {
    await ensurePrimaryMembership(
      supabase,
      id,
      data.wedding_id,
      patch.guest_group,
    );
  }
  return data;
}

export async function deleteGuest(id: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("guests").delete().eq("id", id);
  if (error) throw error;
}

/** Owner-side upsert of an RSVP row (records a phone/paper reply from a guest). */
export async function upsertRsvp(input: {
  guest_id: string;
  status: RsvpStatus;
  dietary_notes?: string | null;
  message?: string | null;
}): Promise<Rsvp> {
  const supabase = getBrowserSupabase();
  const row = {
    guest_id: input.guest_id,
    status: input.status,
    dietary_notes: input.dietary_notes ?? null,
    message: input.message ?? null,
    responded_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("rsvps")
    .upsert(row, { onConflict: "guest_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Clear a recorded RSVP so it goes back to "awaiting reply". */
export async function clearRsvp(guestId: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("rsvps").delete().eq("guest_id", guestId);
  if (error) throw error;
}

/** Bump `rsvp_reminder_sent_at` for a set of guests we just nudged. */
export async function markRemindersSent(guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return;
  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("guests")
    .update({ rsvp_reminder_sent_at: new Date().toISOString() })
    .in("id", guestIds);
  if (error) throw error;
}

// ============================================================
// Guest groups (name + colour meta layered on top of the
// existing guests.guest_group text column).
// ============================================================

export async function fetchGuestGroups(weddingId: string): Promise<GuestGroup[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guest_groups")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addGuestGroup(input: {
  wedding_id: string;
  name: string;
  color?: string | null;
  sort_order?: number;
}): Promise<GuestGroup> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guest_groups")
    .insert({
      wedding_id: input.wedding_id,
      name: input.name.trim(),
      color: input.color ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateGuestGroup(
  id: string,
  patch: { name?: string; color?: string | null; sort_order?: number },
): Promise<GuestGroup> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guest_groups")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Rename a group AND every guest that had this group as their primary. */
export async function renameGuestGroup(
  id: string,
  weddingId: string,
  fromName: string,
  toName: string,
): Promise<GuestGroup> {
  const supabase = getBrowserSupabase();
  const trimmed = toName.trim();
  if (!trimmed) throw new Error("Group name is required");
  const { data, error } = await supabase
    .from("guest_groups")
    .update({ name: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (fromName && fromName !== trimmed) {
    const upd = await supabase
      .from("guests")
      .update({ guest_group: trimmed })
      .eq("wedding_id", weddingId)
      .eq("guest_group", fromName);
    if (upd.error) throw upd.error;
  }
  return data;
}

/**
 * Delete the group. Cascades wipe guest_group_members. For guests whose
 * *primary* group was this one, re-derive from any remaining memberships
 * so they don't appear ungrouped when they still belong to another group.
 */
export async function deleteGuestGroup(
  id: string,
  weddingId: string,
  name: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("guest_groups").delete().eq("id", id);
  if (error) throw error;
  // Anyone whose primary text col was this group needs a new primary
  // (the next remaining membership) or null (truly ungrouped).
  const { data: affected } = await supabase
    .from("guests")
    .select(
      "id, guest_group_members(guest_groups(name, created_at))",
    )
    .eq("wedding_id", weddingId)
    .eq("guest_group", name);
  for (const g of (affected as any[] | null) ?? []) {
    const rows = ((g.guest_group_members as any[]) ?? [])
      .map((m) => m?.guest_groups)
      .filter(Boolean) as { name: string; created_at: string }[];
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const nextPrimary = rows[0]?.name ?? null;
    await supabase
      .from("guests")
      .update({ guest_group: nextPrimary })
      .eq("id", g.id);
  }
}

// ============================================================
// Multi-group membership (join table)
// ============================================================

/**
 * Toggle a guest into a group. Also mirrors to the guest's primary text
 * column when they don't already have one, so legacy screens stay populated.
 */
export async function addGuestToGroup(
  guestId: string,
  group: { id: string; name: string },
): Promise<void> {
  const supabase = getBrowserSupabase();
  const ins = await supabase
    .from("guest_group_members")
    .insert({ guest_id: guestId, group_id: group.id });
  if (ins.error && (ins.error as { code?: string }).code !== "23505") {
    throw ins.error;
  }
  const { data: g } = await supabase
    .from("guests")
    .select("guest_group")
    .eq("id", guestId)
    .single();
  if (!g?.guest_group) {
    await supabase
      .from("guests")
      .update({ guest_group: group.name })
      .eq("id", guestId);
  }
}

/**
 * Remove a guest from a group. Deletes the join row (if any) and, if the
 * group was the guest's primary text label, re-derives a new primary from
 * whatever memberships remain.
 */
export async function removeGuestFromGroup(
  guestId: string,
  group: { id: string; name: string },
): Promise<void> {
  const supabase = getBrowserSupabase();
  const del = await supabase
    .from("guest_group_members")
    .delete()
    .eq("guest_id", guestId)
    .eq("group_id", group.id);
  if (del.error) throw del.error;
  const { data: g } = await supabase
    .from("guests")
    .select("guest_group")
    .eq("id", guestId)
    .single();
  if (g?.guest_group === group.name) {
    const { data: remaining } = await supabase
      .from("guest_group_members")
      .select("guest_groups(name, created_at)")
      .eq("guest_id", guestId);
    const rows = ((remaining as any[]) ?? [])
      .map((m) => m?.guest_groups)
      .filter(Boolean) as { name: string; created_at: string }[];
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const next = rows[0]?.name ?? null;
    await supabase
      .from("guests")
      .update({ guest_group: next })
      .eq("id", guestId);
  }
}

// ============================================================
// Room blocks (Stays)
// ============================================================

export async function fetchRoomBlocks(weddingId: string): Promise<RoomBlock[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("room_blocks")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addRoomBlock(input: {
  wedding_id: string;
  name: string;
  note?: string | null;
  price_note?: string | null;
  status?: string | null;
  capacity_rooms?: number;
  booked_rooms?: number;
  tone?: string;
}): Promise<RoomBlock> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("room_blocks")
    .insert({
      wedding_id: input.wedding_id,
      name: input.name.trim(),
      note: input.note ?? null,
      price_note: input.price_note ?? null,
      status: input.status ?? null,
      capacity_rooms: input.capacity_rooms ?? 0,
      booked_rooms: input.booked_rooms ?? 0,
      tone: input.tone ?? "accent",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateRoomBlock(
  id: string,
  patch: Partial<Omit<RoomBlock, "id" | "wedding_id" | "created_at">>,
): Promise<RoomBlock> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("room_blocks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoomBlock(id: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("room_blocks").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Seating tables
// ============================================================

export async function fetchSeatingTables(weddingId: string): Promise<SeatingTable[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("seating_tables")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addSeatingTable(input: {
  wedding_id: string;
  name: string;
  capacity?: number;
  x_pct?: number;
  y_pct?: number;
  tone?: string;
  is_head?: boolean;
  shape?: "round" | "rect";
}): Promise<SeatingTable> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("seating_tables")
    .insert({
      wedding_id: input.wedding_id,
      name: input.name.trim(),
      capacity: input.capacity ?? 8,
      x_pct: input.x_pct ?? 50,
      y_pct: input.y_pct ?? 50,
      tone: input.tone ?? "accent",
      is_head: input.is_head ?? false,
      shape: input.shape ?? "round",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSeatingTable(
  id: string,
  patch: Partial<Omit<SeatingTable, "id" | "wedding_id" | "created_at">>,
): Promise<SeatingTable> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("seating_tables")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSeatingTable(id: string): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("seating_tables").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Guest relationships (parent_of, partner_of)
// ============================================================

export type GuestLink = {
  guest: Pick<Guest, "id" | "first_name" | "last_name" | "age_years">;
  kind: GuestRelationshipKind;
  direction: "outgoing" | "incoming";
};

/**
 * All relationships anchored to a single guest, in both directions.
 * Outgoing: this guest → other. Incoming: other → this guest.
 * The two edges of a partner_of pair are collapsed to a single
 * "outgoing" entry so the UI shows one partner chip, not two.
 */
export async function fetchGuestLinks(guestId: string): Promise<GuestLink[]> {
  const supabase = getBrowserSupabase();
  const [outgoing, incoming] = await Promise.all([
    supabase
      .from("guest_relationships")
      .select(
        "kind, to_guest, guests!guest_relationships_to_guest_fkey(id, first_name, last_name, age_years)",
      )
      .eq("from_guest", guestId),
    supabase
      .from("guest_relationships")
      .select(
        "kind, from_guest, guests!guest_relationships_from_guest_fkey(id, first_name, last_name, age_years)",
      )
      .eq("to_guest", guestId),
  ]);
  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;

  const seenPartner = new Set<string>();
  const out: GuestLink[] = [];
  for (const r of (outgoing.data as any[]) ?? []) {
    const g = r.guests;
    if (!g) continue;
    if (r.kind === "partner_of") seenPartner.add(g.id);
    out.push({ guest: g, kind: r.kind, direction: "outgoing" });
  }
  for (const r of (incoming.data as any[]) ?? []) {
    const g = r.guests;
    if (!g) continue;
    // Skip the mirror side of a partner_of pair we've already recorded.
    if (r.kind === "partner_of" && seenPartner.has(g.id)) continue;
    out.push({ guest: g, kind: r.kind, direction: "incoming" });
  }
  return out;
}

/**
 * Atomic guest creation: inserts the guest row, the parent_of edges for
 * each supplied parent, the (mirrored) partner_of edges for the partner,
 * the primary text group (creating the guest_groups row if needed) and
 * any extra group memberships — all inside one server-side transaction.
 * A failure anywhere leaves the database exactly as it was, so the caller
 * doesn't need to reason about half-created guests.
 */
/**
 * Shape of a not-yet-persisted related guest that the add-guest form
 * carries in state (the partner or a child typed inline). The RPC will
 * turn each of these into its own guest row plus the appropriate
 * relationship edge, atomically with the primary guest.
 */
export type NewRelatedGuest = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  age_years?: number | null;
  role?: string | null;
  notes?: string | null;
  /**
   * Frontend-only: the chip picker keeps the full group objects so
   * the UI can show colours and remove-buttons. At submit time
   * createGuestWithLinks derives guest_group (primary text label)
   * from chips[0] and passes every id in guest_group_ids to the RPC.
   */
  group_chips?: Array<{ id: string; name: string; color?: string | null }>;
};

/** Turn a UI-side NewRelatedGuest into the jsonb shape the RPC reads. */
function marshalRelative(r: NewRelatedGuest): Record<string, unknown> {
  const chips = r.group_chips ?? [];
  return {
    first_name: r.first_name,
    last_name: r.last_name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    age_years: r.age_years ?? null,
    role: r.role ?? null,
    notes: r.notes ?? null,
    guest_group: chips[0]?.name ?? null,
    guest_group_ids: chips.map((c) => c.id),
  };
}

export async function createGuestWithLinks(input: {
  wedding_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  age_years?: number | null;
  role?: string | null;
  notes?: string | null;
  primary_group?: string | null;
  group_ids?: string[];
  parent_ids?: string[];
  partner_id?: string | null;
  new_partner?: NewRelatedGuest | null;
  new_children?: NewRelatedGuest[];
}): Promise<Guest> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.rpc("create_guest_with_links", {
    p_wedding_id: input.wedding_id,
    p_first_name: input.first_name,
    p_last_name: input.last_name ?? undefined,
    p_email: input.email ?? undefined,
    p_phone: input.phone ?? undefined,
    p_age_years: input.age_years ?? undefined,
    p_role: input.role ?? undefined,
    p_notes: input.notes ?? undefined,
    p_primary_group: input.primary_group ?? undefined,
    p_group_ids: input.group_ids ?? [],
    p_parent_ids: input.parent_ids ?? [],
    p_partner_id: input.partner_id ?? undefined,
    p_new_partner: input.new_partner
      ? (marshalRelative(input.new_partner) as unknown as import("@union/shared").Json)
      : undefined,
    p_new_children:
      input.new_children && input.new_children.length > 0
        ? (input.new_children.map(marshalRelative) as unknown as import("@union/shared").Json[])
        : undefined,
  });
  if (error) throw error;
  return data as unknown as Guest;
}

export async function addGuestRelationship(input: {
  wedding_id: string;
  from_guest: string;
  to_guest: string;
  kind: GuestRelationshipKind;
}): Promise<void> {
  const supabase = getBrowserSupabase();
  const rows: GuestRelationship[] =
    input.kind === "partner_of"
      ? [
          { ...input, created_at: new Date().toISOString() } as GuestRelationship,
          {
            wedding_id: input.wedding_id,
            from_guest: input.to_guest,
            to_guest: input.from_guest,
            kind: "partner_of",
            created_at: new Date().toISOString(),
          } as GuestRelationship,
        ]
      : [{ ...input, created_at: new Date().toISOString() } as GuestRelationship];
  const { error } = await supabase
    .from("guest_relationships")
    .upsert(rows, { onConflict: "from_guest,to_guest,kind" });
  if (error) throw error;
}

/**
 * Owner-side merge: fold `sourceId` into `targetId`. Auth-gated inside
 * the RPC by the wedding's owner_id — safe to call from the duplicates
 * review screen. Returns the surviving target guest id.
 *
 * `overrides` is an object of resolved field values to write to the
 * target BEFORE the fold, inside the same transaction. Use it when
 * the two rows have conflicting values on a field and the user has
 * picked one (or typed a new one). Only whitelisted keys are honoured
 * server-side: first_name, last_name, email, phone, age_years, role,
 * notes, guest_group.
 */
export type MergeOverrides = Partial<{
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  age_years: number | null;
  role: string | null;
  notes: string | null;
  guest_group: string | null;
}>;

export async function ownerMergeGuests(
  sourceId: string,
  targetId: string,
  overrides?: MergeOverrides,
): Promise<string> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.rpc("owner_merge_guests", {
    p_source_guest_id: sourceId,
    p_target_guest_id: targetId,
    p_target_overrides:
      overrides && Object.keys(overrides).length > 0
        ? (overrides as unknown as import("@union/shared").Json)
        : undefined,
  });
  if (error) throw error;
  const payload = (data ?? {}) as { status?: string; guest_id?: string };
  if (payload.status !== "merged" || !payload.guest_id) {
    throw new Error("Merge failed");
  }
  return payload.guest_id;
}

/** Hide (dismiss) a duplicate cluster suggestion. Persists per wedding. */
export async function hideDuplicateCluster(
  weddingId: string,
  guestIds: string[],
): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("hide_duplicate_cluster", {
    p_wedding_id: weddingId,
    p_guest_ids: guestIds,
  });
  if (error) throw error;
}

/** Restore a previously hidden cluster suggestion. */
export async function unhideDuplicateCluster(
  weddingId: string,
  guestIds: string[],
): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("unhide_duplicate_cluster", {
    p_wedding_id: weddingId,
    p_guest_ids: guestIds,
  });
  if (error) throw error;
}

/**
 * Clusters the user has previously dismissed. Same shape as
 * fetchDuplicateGroups so the UI can reuse the same renderer.
 */
export async function fetchHiddenDuplicateClusters(
  weddingId: string,
): Promise<DuplicateCandidate[][]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.rpc("list_hidden_merge_clusters", {
    p_wedding_id: weddingId,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data as DuplicateCandidate[][];
}

/** One guest row inside a duplicate cluster returned by find_duplicate_groups. */
export type DuplicateCandidate = {
  id: string;
  first_name: string;
  last_name: string | null;
  age_years: number | null;
  email: string | null;
  phone: string | null;
  guest_group: string | null;
  role: string | null;
  notes: string | null;
  rsvp_status: RsvpStatus;
  added_by_first_name: string | null;
};

/**
 * Load pre-clustered duplicate groups for the wedding. The predicate and
 * clustering both live server-side (find_duplicate_groups) so this stays
 * in sync with the RSVP self-merge candidates.
 */
export async function fetchDuplicateGroups(
  weddingId: string,
): Promise<DuplicateCandidate[][]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.rpc("find_duplicate_groups", {
    p_wedding_id: weddingId,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data as DuplicateCandidate[][];
}

export async function removeGuestRelationship(input: {
  from_guest: string;
  to_guest: string;
  kind: GuestRelationshipKind;
}): Promise<void> {
  const supabase = getBrowserSupabase();
  const pairs: Array<{ from: string; to: string }> =
    input.kind === "partner_of"
      ? [
          { from: input.from_guest, to: input.to_guest },
          { from: input.to_guest, to: input.from_guest },
        ]
      : [{ from: input.from_guest, to: input.to_guest }];
  for (const p of pairs) {
    const { error } = await supabase
      .from("guest_relationships")
      .delete()
      .eq("from_guest", p.from)
      .eq("to_guest", p.to)
      .eq("kind", input.kind);
    if (error) throw error;
  }
}

// ============================================================
// RSVP form question config (jsonb on weddings)
// ============================================================

/** Read the couple's custom RSVP-form config, or [] if never saved. */
export function readRsvpQuestions(wedding: Wedding | null): RsvpQuestion[] {
  const raw = wedding?.rsvp_form_questions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is RsvpQuestion => !!q && typeof q === "object" && "id" in q);
}

export async function saveRsvpQuestions(
  weddingId: string,
  questions: RsvpQuestion[],
): Promise<Wedding> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("weddings")
    .update({ rsvp_form_questions: questions })
    .eq("id", weddingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Roll up a guest list into the headline counts shown on Today / Guests. */
export function guestStats(guests: GuestWithRsvp[]) {
  let coming = 0;
  let declined = 0;
  let waiting = 0;
  for (const g of guests) {
    const status = g.rsvps?.status ?? "pending";
    if (status === "attending") coming += 1;
    else if (status === "declined") declined += 1;
    else waiting += 1;
  }
  return {
    invited: guests.length,
    coming,
    declined,
    waiting,
    headcount: coming,
    parties: guests.length,
  };
}
