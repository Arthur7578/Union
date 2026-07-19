export { createUnionClient } from "./supabase";
export type { UnionClient } from "./supabase";
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database.types";
export { Constants } from "./database.types";

// Convenience row aliases used across apps.
import type { Tables, Enums } from "./database.types";

export type Profile = Tables<"profiles">;
export type Wedding = Tables<"weddings">;
export type Guest = Tables<"guests">;
export type Rsvp = Tables<"rsvps">;
export type RsvpStatus = Enums<"rsvp_status">;
export type GuestGroup = Tables<"guest_groups">;
export type RoomBlock = Tables<"room_blocks">;
export type SeatingTable = Tables<"seating_tables">;

/** One entry in the couple's custom RSVP-form config (stored on weddings.rsvp_form_questions). */
export type RsvpQuestion = {
  id: string;
  kind: "single" | "multi" | "short" | "comment";
  title: string;
  required: boolean;
  options?: string[];
};

/** Row shape returned by the `get_invitation` RPC. */
export type Invitation = {
  guest_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  party_size: number;
  partner_one: string | null;
  partner_two: string | null;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_status: RsvpStatus;
  num_attending: number | null;
  dietary_notes: string | null;
  message: string | null;
};
