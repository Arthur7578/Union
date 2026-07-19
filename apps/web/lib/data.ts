"use client";

import { getBrowserSupabase } from "./supabaseClient";
import type {
  Guest,
  GuestGroup,
  RoomBlock,
  Rsvp,
  RsvpQuestion,
  RsvpStatus,
  SeatingTable,
  Wedding,
} from "@union/shared";

/** A guest row joined with its (optional) rsvp. */
export type GuestWithRsvp = Guest & { rsvps: Rsvp | null };

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
  input: Omit<Wedding, "id" | "created_at" | "rsvp_form_questions"> & {
    rsvp_form_questions?: Wedding["rsvp_form_questions"];
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

export async function fetchGuests(weddingId: string): Promise<GuestWithRsvp[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .select("*, rsvps(*)")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((g) => ({
    ...g,
    rsvps: Array.isArray(g.rsvps) ? (g.rsvps[0] ?? null) : (g.rsvps ?? null),
  })) as GuestWithRsvp[];
}

export async function fetchGuest(id: string): Promise<GuestWithRsvp | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .select("*, rsvps(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    rsvps: Array.isArray(data.rsvps)
      ? (data.rsvps[0] ?? null)
      : (data.rsvps ?? null),
  } as GuestWithRsvp;
}

export type NewGuest = {
  wedding_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  party_size?: number;
  guest_group?: string | null;
  role?: string | null;
  notes?: string | null;
  room_block_id?: string | null;
  seating_table_id?: string | null;
};

export async function addGuest(input: NewGuest): Promise<Guest> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("guests")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
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
  num_attending?: number | null;
  dietary_notes?: string | null;
  message?: string | null;
}): Promise<Rsvp> {
  const supabase = getBrowserSupabase();
  const row = {
    guest_id: input.guest_id,
    status: input.status,
    num_attending: input.num_attending ?? null,
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

/** Rename a group AND every guest currently in it, in that order. */
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

/** Delete the group and clear every guest that was in it. */
export async function deleteGuestGroup(
  id: string,
  weddingId: string,
  name: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const upd = await supabase
    .from("guests")
    .update({ guest_group: null })
    .eq("wedding_id", weddingId)
    .eq("guest_group", name);
  if (upd.error) throw upd.error;
  const { error } = await supabase.from("guest_groups").delete().eq("id", id);
  if (error) throw error;
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
  let invited = 0;
  let coming = 0;
  let declined = 0;
  let waiting = 0;
  let headcount = 0;
  for (const g of guests) {
    invited += g.party_size ?? 1;
    const status = g.rsvps?.status ?? "pending";
    if (status === "attending") {
      coming += g.party_size ?? 1;
      headcount += g.rsvps?.num_attending ?? g.party_size ?? 1;
    } else if (status === "declined") {
      declined += g.party_size ?? 1;
    } else {
      waiting += g.party_size ?? 1;
    }
  }
  return {
    invited,
    coming,
    declined,
    waiting,
    headcount,
    parties: guests.length,
  };
}
