import type { LocalizedText } from "./localized";

/**
 * The faire-part's wording, as the couple can edit it.
 *
 * Each slot is one line or paragraph of the card, stored per language as a
 * template: plain text with `{{fields}}` the guest's own data fills in.
 *
 *   {{area|city}}   the first of these that has a value
 *   [ en {{area}}]  an optional part: dropped whole when a field inside is empty
 *
 * A field outside brackets that is empty drops its whole slot, so a greeting
 * made of "{{guest_first_name}}," simply disappears on a group link.
 */
export const FAIRE_PART_SLOTS = [
  // Front of the card, under the couple's names.
  "front_intro",
  "front_dates",
  "front_place",
  // Back of the card, top to bottom.
  "greeting",
  "moments",
  "invite",
  "hope",
  "closing",
  "signature",
] as const;
export type FairePartSlot = (typeof FAIRE_PART_SLOTS)[number];

/** What a template may mention. See `fairePartFields` in the web app for how each is filled. */
export const FAIRE_PART_FIELDS = [
  "guest_first_name",
  "partner_one",
  "partner_two",
  "couple",
  "dates",
  "dates_spoken",
  "duration",
  "venue",
  "area",
  "city",
  "country",
] as const;
export type FairePartField = (typeof FAIRE_PART_FIELDS)[number];

/** The `weddings.faire_part_copy` column: slot → language → template. */
export type FairePartCopy = Partial<Record<FairePartSlot, LocalizedText>>;
