import { supabase } from "./supabase";
import type { Guest, Rsvp, Wedding } from "@union/shared";

/** A guest row joined with its (optional) rsvp. */
export type GuestWithRsvp = Guest & { rsvps: Rsvp | null };

export async function fetchWedding(ownerId: string): Promise<Wedding | null> {
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
    | "sms_sender"
    | "sms_template"
    | "sms_brevo_api_key"
  > & {
    rsvp_form_questions?: Wedding["rsvp_form_questions"];
    ceremony_rows?: number;
    ceremony_reserved_rows?: number;
    allow_guests_add_partner?: boolean;
    allow_guests_add_children?: boolean;
    max_children_per_guest?: number | null;
    guest_count_target?: number | null;
    style_vibe?: string | null;
    sms_sender?: string | null;
    sms_template?: string | null;
    sms_brevo_api_key?: string | null;
  },
): Promise<Wedding> {
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
  const { data, error } = await supabase
    .from("guests")
    .select("*, rsvps(*)")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // supabase returns rsvps as an array for the embedded relation; flatten it.
  return (data ?? []).map((g) => ({
    ...g,
    rsvps: Array.isArray(g.rsvps) ? (g.rsvps[0] ?? null) : (g.rsvps ?? null),
  })) as GuestWithRsvp[];
}

export async function fetchGuest(id: string): Promise<GuestWithRsvp | null> {
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
  age_years?: number | null;
  guest_group?: string | null;
};

export async function addGuest(input: NewGuest): Promise<Guest> {
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
  const { error } = await supabase.from("guests").delete().eq("id", id);
  if (error) throw error;
}
