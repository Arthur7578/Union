"use client";

import { getBrowserSupabase } from "./supabaseClient";
import type { Guest, Rsvp, Wedding } from "@union/shared";

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
  input: Omit<Wedding, "id" | "created_at">,
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
