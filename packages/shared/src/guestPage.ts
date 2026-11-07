/**
 * The couple's own content for the guest page (migration
 * 20261103120000_guest_page_content): their word, how to get there, the
 * weekend, the dress code and their questions. Guests read it through
 * `get_guest_page`; the organiser writes it table by table.
 *
 * What the app already knows (names, date, venue, address, RSVP deadline,
 * stays, carpooling) is never part of this content: it is read from where it
 * lives, so it is typed once and never goes stale.
 *
 * Kept free of anything web-specific so the native app can reuse it.
 */
import { isTextEmpty } from "./localized";
import type { LocalizedText, StoredText } from "./localized";

/** The page texts. Every field is couple-written, localized text. */
export type GuestPageTexts = {
  /** Le mot. Paragraphs are separated by a blank line. */
  welcome: StoredText;
  travel_train: StoredText;
  travel_plane: StoredText;
  travel_car: StoredText;
  /** Only present for a household that said yes: the server withholds it. */
  shuttle: StoredText;
  dress_code: StoredText;
  dress_text: StoredText;
  dress_note: StoredText;
  palette: GuestPageSwatch[];
};

export type GuestPageSwatch = { color: string; name?: LocalizedText };

export type GuestPageMoment = {
  id: string;
  /** Days from the wedding day: -1 the day before, 0 the day, 1 the day after. */
  day_offset: number;
  /** "HH:MM", or null for a moment with no set hour. */
  starts_at: string | null;
  title: StoredText;
  place: StoredText;
  note: StoredText;
};

export type GuestPageQuestion = { id: string; question: StoredText; answer: StoredText };

/** A stay as guests see it: the couple's bookkeeping (note, status, rooms)
 *  never leaves the server. */
export type GuestPageStay = { id: string; name: string; price_note: string | null };

export type GuestPageContent = {
  page: GuestPageTexts | null;
  moments: GuestPageMoment[];
  faq: GuestPageQuestion[];
  stays: GuestPageStay[];
};

/** Days a moment can sit from the wedding day, as the database allows. */
export const MOMENT_DAY_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** At most this many swatches in a palette, as the database allows. */
export const PALETTE_MAX = 6;

export const EMPTY_GUEST_PAGE: GuestPageContent = { page: null, moments: [], faq: [], stays: [] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown): StoredText =>
  typeof v === "string" || isObject(v) ? (v as StoredText) : null;

const HEX = /^#[0-9A-Fa-f]{6}$/;

function parseSwatches(raw: unknown): GuestPageSwatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => isObject(s) && typeof s.color === "string" && HEX.test(s.color))
    .slice(0, PALETTE_MAX)
    .map((s) => (isObject(s.name) ? { color: s.color as string, name: s.name as LocalizedText } : { color: s.color as string }));
}

/**
 * Reads what `get_guest_page` returned, tolerating anything missing or
 * malformed: a broken row must never blank out the rest of the invitation.
 */
export function parseGuestPage(raw: unknown): GuestPageContent {
  if (!isObject(raw)) return EMPTY_GUEST_PAGE;
  const p = isObject(raw.page) ? raw.page : null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);
  return {
    page: p
      ? {
          welcome: text(p.welcome),
          travel_train: text(p.travel_train),
          travel_plane: text(p.travel_plane),
          travel_car: text(p.travel_car),
          shuttle: text(p.shuttle),
          dress_code: text(p.dress_code),
          dress_text: text(p.dress_text),
          dress_note: text(p.dress_note),
          palette: parseSwatches(p.palette),
        }
      : null,
    moments: list(raw.moments)
      .filter((m) => typeof m.id === "string" && typeof m.day_offset === "number")
      .map((m) => ({
        id: m.id as string,
        day_offset: m.day_offset as number,
        starts_at: typeof m.starts_at === "string" ? m.starts_at : null,
        title: text(m.title),
        place: text(m.place),
        note: text(m.note),
      })),
    faq: list(raw.faq)
      .filter((f) => typeof f.id === "string")
      .map((f) => ({ id: f.id as string, question: text(f.question), answer: text(f.answer) })),
    stays: list(raw.stays)
      .filter((s) => typeof s.id === "string" && typeof s.name === "string")
      .map((s) => ({
        id: s.id as string,
        name: s.name as string,
        price_note: typeof s.price_note === "string" && s.price_note.trim() ? s.price_note : null,
      })),
  };
}

/**
 * The calendar date of a moment, "YYYY-MM-DD", or null while the wedding has
 * no date. Pure date arithmetic in UTC so no timezone can shift the day.
 */
export function momentDate(eventDate: string | null | undefined, dayOffset: number): string | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const [y, m, d] = eventDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + dayOffset));
  return date.toISOString().slice(0, 10);
}

export type MomentDay<M extends { day_offset: number; starts_at: string | null }> = {
  dayOffset: number;
  /** "YYYY-MM-DD", or null while the wedding has no date. */
  date: string | null;
  moments: M[];
};

/**
 * Moments grouped by day, days in order and, within a day, moments with no
 * set hour first then by time. The order guests read and the organiser edits.
 */
export function groupMomentsByDay<M extends { day_offset: number; starts_at: string | null }>(
  moments: readonly M[],
  eventDate: string | null | undefined,
): MomentDay<M>[] {
  const byDay = new Map<number, M[]>();
  for (const m of moments) {
    const list = byDay.get(m.day_offset) ?? [];
    list.push(m);
    byDay.set(m.day_offset, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayOffset, list]) => ({
      dayOffset,
      date: momentDate(eventDate, dayOffset),
      moments: [...list].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")),
    }));
}

/** Splits Le mot into paragraphs on blank lines. */
export function paragraphs(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * A suggested answer to "are children invited?", from the wedding's own
 * guest permissions, in French and English. The organiser can reword it; it
 * only saves them typing what the app already knows.
 */
export function suggestedChildrenAnswer(wedding: {
  allow_guests_add_children: boolean;
  max_children_per_guest: number | null;
}): LocalizedText {
  if (!wedding.allow_guests_add_children) {
    return {
      fr: "Les enfants attendus sont ceux nommés sur votre invitation.",
      en: "The children we are expecting are the ones named on your invitation.",
    };
  }
  const max = wedding.max_children_per_guest;
  if (max && max > 0) {
    return {
      fr: `Oui, avec joie. Vous pouvez ajouter jusqu’à ${max} enfant${max > 1 ? "s" : ""} en répondant.`,
      en: `Yes, gladly. You can add up to ${max} ${max > 1 ? "children" : "child"} when you reply.`,
    };
  }
  return {
    fr: "Oui, avec joie. Vous pouvez les ajouter en répondant.",
    en: "Yes, gladly. You can add them when you reply.",
  };
}

/** A suggested answer to "who do I contact?", from a co-organiser's profile. */
export function suggestedContactAnswer(profile: { full_name: string | null; phone: string | null }): LocalizedText | null {
  const name = profile.full_name?.trim();
  const phone = profile.phone?.trim();
  if (!name && !phone) return null;
  const who = [name, phone].filter(Boolean).join(" · ");
  return { fr: who, en: who };
}

/** What a page part needs to know whether it has anything to show. Shaped
 *  loosely so both the guest's content and the organiser's editable copy fit. */
export type PartContentInput = {
  page: {
    welcome?: StoredText;
    travel_train?: StoredText;
    travel_plane?: StoredText;
    travel_car?: StoredText;
    shuttle?: StoredText;
    dress_code?: StoredText;
    dress_text?: StoredText;
    dress_note?: StoredText;
    palette?: readonly unknown[];
  } | null;
  moments: readonly unknown[];
  faq: readonly unknown[];
  stays?: readonly unknown[];
  /** From the wedding settings, as the guest is allowed to see them. */
  venueName?: string | null;
  address?: string | null;
};

const someText = (...values: StoredText[]) => values.some((v) => !isTextEmpty(v));

/**
 * Whether a part of the wedding page has something to show. A part that is
 * on but empty is left out of the guest's page (no empty title), and the
 * organiser sees it as "empty". Carpooling has no content of its own to
 * check, so it always counts as having some.
 */
export function partHasContent(
  part: "word" | "weekend" | "venue" | "travel" | "dress" | "faq",
  input: PartContentInput,
): boolean {
  const p = input.page;
  switch (part) {
    case "word":
      return someText(p?.welcome);
    case "weekend":
      return input.moments.length > 0;
    case "venue":
      return (
        Boolean(input.venueName?.trim() || input.address?.trim()) ||
        someText(p?.travel_train, p?.travel_plane, p?.travel_car, p?.shuttle) ||
        (input.stays?.length ?? 0) > 0
      );
    case "travel":
      return true;
    case "dress":
      return someText(p?.dress_code, p?.dress_text, p?.dress_note) || (p?.palette?.length ?? 0) > 0;
    case "faq":
      return input.faq.length > 0;
  }
}
