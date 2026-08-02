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
export type GuestRelationshipKind = Enums<"guest_relationship_kind">;

/** One form the couple runs — RSVP now, a details form later, a final headcount near the day. */
export type Form = Tables<"forms">;
/** `kind` is 'rsvp' for a form wired to the real guest RSVP flow, 'custom' for anything else. */
export type FormKind = "rsvp" | "custom";
/** Only meaningful when kind === 'rsvp'. 'primary' is the one RSVP; 'reconfirmation' is an
 *  optional later touchpoint (e.g. a final headcount close to the day) — same RSVP block,
 *  its own schedule. Exactly one of each may exist per wedding. */
export type FormPurpose = "primary" | "reconfirmation";
/** Derived at read time from `published` + `opens_at`/`closes_at` vs now — not stored directly. */
export type FormStatus = "draft" | "scheduled" | "live" | "closed";

/** One question in a form's guest-facing question list (stored on forms.questions). */
export type RsvpQuestion = {
  id: string;
  kind: "single" | "multi" | "short" | "comment";
  title: string;
  required: boolean;
  options?: string[];
};

/** Guest-facing wording for the RSVP system block (stored on forms.rsvp_copy).
 *
 *  Deliberately a fixed set of named slots, not a free-form list: each key is
 *  bound to one real rsvp_status value (or is pure framing copy), so rewording
 *  can never silently invert which button means "coming" vs "not coming" —
 *  there's no shared, reorderable list for two labels to swap places in.
 *  Every key is optional; a blank value means "use the system default",
 *  which is where the actual attending/declined semantics live. */
export type RsvpBlockCopy = {
  /** Guest-facing headline. Not forms.title — that stays organiser-only. */
  title?: string;
  subtitle?: string;
  /** Label for the button that sets rsvp status to 'attending'. Fixed slot — never reorderable. */
  label_attending?: string;
  /** Label for the button that sets rsvp status to 'declined'. Fixed slot — never reorderable. */
  label_declined?: string;
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
    age_years: number | null;
    rsvp_status: RsvpStatus;
    dietary_notes: string | null;
    message: string | null;
  };
  companions: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    age_years: number | null;
    relationship: GuestRelationshipKind;
    rsvp_status: RsvpStatus;
    dietary_notes: string | null;
  }>;
  permissions: {
    can_add_partner: boolean;
    can_add_kids: boolean;
    /** null means no cap; 0 means adding children is disabled. */
    kids_remaining: number | null;
  };
  self_merge_candidates: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    age_years: number | null;
    added_by_first_name: string | null;
  }>;
};
