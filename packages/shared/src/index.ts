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
export type GuestRelationship = Tables<"guest_relationships">;
export type GuestKind = Enums<"guest_kind">;
export type GuestRelationshipKind = Enums<"guest_relationship_kind">;

/** One entry in the couple's custom RSVP-form config (stored on weddings.rsvp_form_questions). */
export type RsvpQuestion = {
  id: string;
  kind: "single" | "multi" | "short" | "comment";
  title: string;
  required: boolean;
  options?: string[];
};

/** Payload shape returned by the `get_invitation` RPC. */
export type Invitation = {
  wedding: {
    partner_one: string | null;
    partner_two: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
  };
  guest: {
    id: string;
    first_name: string;
    last_name: string | null;
    kind: GuestKind;
    rsvp_status: RsvpStatus;
    dietary_notes: string | null;
    message: string | null;
  };
  companions: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    kind: GuestKind;
    relationship: GuestRelationshipKind;
    rsvp_status: RsvpStatus;
    dietary_notes: string | null;
  }>;
  permissions: {
    can_add_partner: boolean;
    can_add_kids: boolean;
    /** null means no cap; 0 means adding kids is disabled. */
    kids_remaining: number | null;
  };
  self_merge_candidates: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    kind: GuestKind;
    added_by_first_name: string | null;
  }>;
};
