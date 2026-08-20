/**
 * Which extras the RSVP block asks for, beyond the reply itself.
 *
 * The RSVP block is a system block: the two reply buttons are wired to real
 * `rsvp_status` values in code and are not the couple's to remove. Everything
 * *around* that reply is optional, though — dietary needs for the guest,
 * dietary needs for each companion, a message for the couple — and asking for
 * it in the RSVP is a choice, not a given. A wedding that collects meals and
 * allergies in a later "guest details" form was asking the same question
 * twice, with no way to turn the duplicate off and no say in which form the
 * answer landed in.
 *
 * Storage keeps only what the couple has changed, as a jsonb map on
 * `forms.rsvp_fields`:
 *
 * ```json
 * { "dietary": false, "companion_dietary": false }
 * ```
 *
 * An absent key means the field is **asked**. Same reasoning as
 * `weddings.guest_modules`: every RSVP form written before this column holds
 * `{}` and so asks exactly what it did before, and a field added to the block
 * later ships asked-for rather than silently missing.
 *
 * Turning a field off is presentation only — nothing a guest already answered
 * is deleted, and turning it back on brings those answers back into view. The
 * organiser can still record dietary notes by hand from the guest's page
 * whatever this says: it governs what *guests are asked*, not what the couple
 * is allowed to know.
 *
 * Only the primary RSVP form carries these. A reconfirmation form reuses the
 * primary's block wholesale — same buttons, same extras — so it reads the
 * primary's map rather than keeping one of its own, exactly as it already
 * does for the two button labels.
 *
 * The database enforces the same shape (`_rsvp_fields_valid`). Readers here
 * are permissive anyway — an unknown key, a non-boolean, or a null column
 * resolves to "asked" rather than throwing, because a malformed row must
 * never quietly stop collecting a guest's allergies.
 */

/** Every optional field the RSVP block can ask for, in the order guests meet
 *  them. */
export const RSVP_FIELD_KEYS = [
  "dietary",
  "companion_dietary",
  "note",
] as const;

export type RsvpFieldKey = (typeof RSVP_FIELD_KEYS)[number];

/** Fully resolved state: one explicit boolean per field, no absent keys. */
export type RsvpFields = Record<RsvpFieldKey, boolean>;

/** What actually comes back from jsonb: the map, or nothing at all. */
export type StoredRsvpFields =
  | Partial<Record<string, boolean>>
  | null
  | undefined;

export function isRsvpFieldKey(key: string): key is RsvpFieldKey {
  return (RSVP_FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * Resolves a stored map into one boolean per field.
 *
 * Anything that isn't an explicit `false` for a known key leaves that field
 * asked: missing keys, unknown keys, non-boolean values, a null column, or a
 * value that isn't an object at all.
 */
export function resolveRsvpFields(stored: unknown): RsvpFields {
  const map =
    stored !== null && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const resolved = {} as RsvpFields;
  for (const key of RSVP_FIELD_KEYS) {
    resolved[key] = map[key] !== false;
  }
  return resolved;
}

/** The fields being asked for, in the order guests meet them. */
export function askedRsvpFields(stored: unknown): RsvpFieldKey[] {
  const resolved = resolveRsvpFields(stored);
  return RSVP_FIELD_KEYS.filter((key) => resolved[key]);
}

/**
 * Narrows the full state back down to the "off" decisions worth storing, so a
 * row records what the couple chose rather than a snapshot of today's
 * defaults — which is what lets a field added later default to asked.
 */
export function toStoredRsvpFields(
  fields: RsvpFields,
): Partial<Record<RsvpFieldKey, boolean>> {
  const stored: Partial<Record<RsvpFieldKey, boolean>> = {};
  for (const key of RSVP_FIELD_KEYS) {
    if (!fields[key]) stored[key] = false;
  }
  return stored;
}
