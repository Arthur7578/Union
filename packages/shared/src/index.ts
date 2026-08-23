export { createUnionClient } from "./supabase";
export type { UnionClient } from "./supabase";
export {
  AUTO_TRANSLATED_KEY,
  isAutoTranslated,
  isLocaleKey,
  isTextEmpty,
  resolveText,
  setAutoTextForLocale,
  setTextForLocale,
  textForLocale,
  toLocalizedText,
} from "./localized";
export type { LocalizedText, StoredText } from "./localized";
export {
  legacyOptionId,
  normalizeQuestion,
  normalizeQuestions,
} from "./questions";
export type {
  RsvpQuestion,
  RsvpQuestionOption,
  StoredRsvpQuestion,
} from "./questions";
export {
  GUEST_MODULE_KEYS,
  enabledGuestModules,
  isGuestModuleKey,
  resolveGuestModules,
  toStoredGuestModules,
} from "./guestModules";
export type {
  GuestModuleKey,
  GuestModules,
  StoredGuestModules,
} from "./guestModules";
export {
  RSVP_ANSWERS,
  isRsvpAnswerAllowed,
  mayAttend,
  rollUpRsvps,
  rsvpAnswers,
} from "./rsvpAnswers";
export type { AnsweredRsvpStatus, RsvpRollup } from "./rsvpAnswers";
export {
  MAX_CHILDREN_CAP,
  buildGuestPermissionsPatch,
  canAddChildren,
  canAddPartner,
  childrenCapFormState,
  choiceToOverride,
  overrideToChoice,
  resolveChildrenCap,
  resolveChildrenRemaining,
  resolveGuestPermission,
} from "./guestPermissions";
export type {
  ChildrenCapMode,
  ChildrenCapProblem,
  ChildrenCapResult,
  GuestPermissionsPatch,
  GuestPermissionsPatchResult,
  PermissionChoice,
  StoredPermissionOverride,
} from "./guestPermissions";
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
import type { LocalizedText } from "./localized";

export type Profile = Tables<"profiles">;
export type Wedding = Tables<"weddings">;
export type Guest = Tables<"guests">;
export type Rsvp = Tables<"rsvps">;
export type RsvpStatus = Enums<"rsvp_status">;
export type GuestJoinAuthMode = Enums<"guest_join_auth_mode">;
export type GuestGroup = Tables<"guest_groups">;
export type RoomBlock = Tables<"room_blocks">;
export type SeatingTable = Tables<"seating_tables">;
export type GuestRelationship = Tables<"guest_relationships">;
export type GuestRelationshipKind = Enums<"guest_relationship_kind">;
export type Collaborator = Tables<"wedding_collaborators">;
export type CollaboratorStatus = "pending" | "active";
export type ActivityLogEntry = Tables<"activity_log">;
export type ActivityActionKey =
  | "guest_added"
  | "rsvp_attending"
  | "rsvp_maybe"
  | "rsvp_declined"
  | "collaborator_invited"
  | "collaborator_joined"
  | "autonomy_changed"
  | "legacy";
export type ActorKind = "person" | "union";
export type Autonomy = "ask" | "suggest" | "auto";

/** One form the couple runs — RSVP now, a details form later, a reconfirmation near the day. */
export type Form = Tables<"forms">;
/** `kind` is 'rsvp' for a form wired to the real guest RSVP flow, 'custom' for anything else. */
export type FormKind = "rsvp" | "custom";
/** Only meaningful when kind === 'rsvp'. 'primary' is the one RSVP; 'reconfirmation' is an
 *  optional later touchpoint (e.g. a final headcount close to the day) — same RSVP block,
 *  its own schedule. Exactly one of each may exist per wedding. */
export type FormPurpose = "primary" | "reconfirmation";
/** Derived at read time from `published` + `opens_at`/`closes_at` vs now — not stored directly. */
export type FormStatus = "draft" | "scheduled" | "live" | "closed";

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
  title?: LocalizedText;
  subtitle?: LocalizedText;
  /** Label for the button that sets rsvp status to 'attending'. Fixed slot — never reorderable. */
  label_attending?: LocalizedText;
  /** Label for the button that sets rsvp status to 'maybe'. Fixed slot — never
   *  reorderable. Only read when the wedding has `allow_rsvp_maybe` on;
   *  wording written here while the option is off is kept, not discarded, so
   *  turning it back on doesn't lose the couple's phrasing. */
  label_maybe?: LocalizedText;
  /** Label for the button that sets rsvp status to 'declined'. Fixed slot — never reorderable. */
  label_declined?: LocalizedText;
};

/** Guest-facing wording for a 'custom' form (stored on forms.guest_copy).
 *
 *  A custom form's `title` column stays organiser-only like every other
 *  form's, and this is the headline guests actually read. Blank falls back to
 *  the organiser name, which is what guests saw before this existed — so
 *  forms built earlier read exactly as they did, and the couple can translate
 *  them whenever they get to it. */
export type FormGuestCopy = {
  title?: LocalizedText;
  subtitle?: LocalizedText;
};

/** A guest's answers to a 'custom' form (stored on form_responses.answers),
 *  keyed by RsvpQuestion.id. A single-choice answer is one
 *  RsvpQuestionOption.id, a multi answer the list of chosen option ids, and
 *  short/comment answers are the guest's own typed text. Choices are stored
 *  as ids so the same answer counts the same whatever language the guest
 *  replied in. */
export type FormAnswers = Record<string, string | string[]>;
export type FormResponse = Tables<"form_responses">;

/** Payload shape returned by the `get_invitation` RPC. */
export type Invitation = {
  wedding: {
    partner_one: string | null;
    partner_two: string | null;
    event_date: string | null;
    venue_name: string | null;
    address_visibility: "hidden" | "area" | "partial" | "full";
    /** Null when the couple has chosen to keep the venue fully hidden. */
    address: {
      line: string | null;
      postal_code: string | null;
      city: string | null;
      area: string | null;
      country: string | null;
    } | null;
    /** The language this wedding's guest-facing content is written for.
     *  The bottom of the ranking: it only decides when the guest hasn't
     *  picked a language, the couple hasn't overridden one for them, and
     *  their browser asks for nothing this app ships. */
    default_locale?: string | null;
    /** Which invitation modules this wedding shows, as stored: only the
     *  couple's "off" decisions. Absent key means on, so `{}` (and a missing
     *  field, from a server older than the column) is the full experience.
     *  Run it through `resolveGuestModules` rather than reading keys directly. */
    guest_modules?: Partial<Record<string, boolean>> | null;
    /** Whether this wedding offers "maybe" alongside attending/declined.
     *  Absent (from a server older than the column) reads as off, which is
     *  the pre-feature behaviour: two answers only. It lives on the wedding
     *  rather than on the RSVP form because a wedding may have no forms row
     *  yet, and "no custom wording" must not come out as "no maybe option". */
    allow_rsvp_maybe?: boolean | null;
  };
  guest: {
    id: string;
    first_name: string;
    last_name: string | null;
    age_years: number | null;
    rsvp_status: RsvpStatus;
    dietary_notes: string | null;
    message: string | null;
    /** The couple's language override for this guest, if they set one.
     *  Beats browser detection and the wedding default; loses to a language
     *  the guest picked for themselves. */
    locale: string | null;
    /** The language this guest picked in their own invitation, if they ever
     *  did. Top of the ranking — nothing overrides a deliberate choice. */
    chosen_locale?: string | null;
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
