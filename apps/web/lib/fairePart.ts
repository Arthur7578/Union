import {
  FAIRE_PART_FIELDS,
  FAIRE_PART_SLOTS,
  textForLocale,
  type FairePartCopy,
  type FairePartField,
  type FairePartSlot,
  type Invitation,
} from "@union/shared";
import { getDictionary, type Locale } from "./i18n";
import { weddingDateText } from "./weddingDates";

/**
 * The faire-part's text: the couple's own wording per slot and language, else
 * the app's default for that language, with the guest's data filled in.
 *
 * Templates are plain text with two bits of syntax (see `@union/shared`):
 *   {{a|b}}   the first of the listed fields that has a value
 *   [ ... ]   an optional part, dropped whole when a field inside is empty
 * A field outside brackets that is empty drops the whole slot.
 */

export type FairePartFields = Record<FairePartField, string>;
export type FairePartLines = Record<FairePartSlot, string>;

/** The parts of the address a guest may read — see `guestPlaceFields`. */
export interface GuestPlace {
  venue: string;
  area: string;
  city: string;
  country: string;
}

export interface FairePartContext {
  /** Only for a personal link; empty on a group link. */
  guestFirstName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  place?: Partial<GuestPlace> | null;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** Every field a template can name, already written for `locale`. Empty when unknown. */
export function fairePartFields(ctx: FairePartContext, locale: Locale): FairePartFields {
  const dates = weddingDateText(ctx.eventDate, ctx.eventEndDate, locale);
  const partnerOne = clean(ctx.partnerOne);
  const partnerTwo = clean(ctx.partnerTwo);
  const place = ctx.place ?? {};
  return {
    guest_first_name: clean(ctx.guestFirstName),
    partner_one: partnerOne,
    partner_two: partnerTwo,
    couple: [partnerOne, partnerTwo].filter(Boolean).join(" & "),
    dates: dates?.short ?? "",
    dates_spoken: dates?.spoken ?? "",
    // Always something: "three days", "a day", or "moments" when no date is known.
    duration: getDictionary(locale).welcome.duration(dates?.days ?? null),
    venue: clean(place.venue),
    area: clean(place.area),
    city: clean(place.city),
    country: clean(place.country),
  };
}

const isField = (name: string): name is FairePartField =>
  (FAIRE_PART_FIELDS as readonly string[]).includes(name);

/** The names a template mentions that are not fields, for the editor to flag. */
export function unknownFields(template: string): string[] {
  const unknown = new Set<string>();
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    for (const name of match[1].split("|").map((n) => n.trim())) {
      if (!isField(name)) unknown.add(name);
    }
  }
  return [...unknown];
}

/** Fills one run of text. Null when a field in it has no value. */
function fill(text: string, fields: FairePartFields): string | null {
  let missing = false;
  const out = text.replace(/\{\{([^{}]*)\}\}/g, (_, expr: string) => {
    const value = expr
      .split("|")
      .map((name) => name.trim())
      .filter(isField)
      .map((name) => fields[name])
      .find(Boolean);
    if (!value) missing = true;
    return value ?? "";
  });
  return missing ? null : out;
}

/**
 * A template with the guest's fields filled in, or "" when the slot should not
 * be shown. Guest data is only ever inserted, never read as template syntax.
 */
export function renderTemplate(template: string, fields: FairePartFields): string {
  let out = "";
  let dropped = false;
  // Split on [optional parts]; odd indices are the parts' insides.
  template.split(/\[([^[\]]*)\]/).forEach((chunk, i) => {
    const filled = fill(chunk, fields);
    if (filled === null) {
      if (i % 2 === 0) dropped = true;
      return;
    }
    out += filled;
  });
  return dropped ? "" : out.replace(/[ \t]+/g, " ").replace(/ +([,.])/g, "$1").trim();
}

/** The template for one slot in one language: the couple's, else the default. */
export function slotTemplate(
  copy: FairePartCopy | null | undefined,
  slot: FairePartSlot,
  locale: Locale,
): string {
  return textForLocale(copy?.[slot], locale).trim() || getDictionary(locale).welcome.copy[slot];
}

/** Every line of the card, ready to show; "" for a line that is left out. */
export function fairePartLines(
  copy: FairePartCopy | null | undefined,
  ctx: FairePartContext,
  locale: Locale,
): FairePartLines {
  const fields = fairePartFields(ctx, locale);
  return Object.fromEntries(
    FAIRE_PART_SLOTS.map((slot) => [slot, renderTemplate(slotTemplate(copy, slot, locale), fields)]),
  ) as FairePartLines;
}

/** The couple's wording as stored, tolerating junk in the jsonb. */
export function readFairePartCopy(value: Invitation["wedding"]["faire_part_copy"] | unknown): FairePartCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: FairePartCopy = {};
  for (const slot of FAIRE_PART_SLOTS) {
    const v = (value as Record<string, unknown>)[slot];
    if (v && typeof v === "object" && !Array.isArray(v)) out[slot] = v as FairePartCopy[FairePartSlot];
  }
  return out;
}
