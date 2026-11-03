"use client";

/**
 * The organiser's side of the guest page content: read and save the three
 * tables (guest_pages, guest_page_moments, guest_page_faq) under the
 * organiser's own row level access. Guests never come through here: they read
 * `get_guest_page` with their link.
 */
import { toLocalizedText, type LocalizedText, type StoredText } from "@union/shared";
import type { Json } from "@union/shared";
import { getBrowserSupabase } from "./supabaseClient";

export type PageTextKey =
  | "welcome"
  | "travel_train"
  | "travel_plane"
  | "travel_car"
  | "shuttle"
  | "dress_code"
  | "dress_text"
  | "dress_note";

export const PAGE_TEXT_KEYS: readonly PageTextKey[] = [
  "welcome",
  "travel_train",
  "travel_plane",
  "travel_car",
  "shuttle",
  "dress_code",
  "dress_text",
  "dress_note",
];

export type EditableSwatch = { color: string; name: LocalizedText };

export type EditablePage = Record<PageTextKey, LocalizedText> & { palette: EditableSwatch[] };

export type EditableMoment = {
  id: string;
  day_offset: number;
  /** "HH:MM" or "" for no set hour. */
  starts_at: string;
  title: LocalizedText;
  place: LocalizedText;
  note: LocalizedText;
};

export type EditableQuestion = { id: string; question: LocalizedText; answer: LocalizedText };

export type EditableGuestPage = {
  page: EditablePage;
  moments: EditableMoment[];
  faq: EditableQuestion[];
};

const asText = (value: unknown, sourceLocale: string): LocalizedText =>
  toLocalizedText(value as StoredText, sourceLocale);

/** Drops blank locales and trims, so what's saved is what guests read. */
const clean = (value: LocalizedText, sourceLocale: string): LocalizedText | null => {
  const out = toLocalizedText(value, sourceLocale);
  return Object.keys(out).length ? out : null;
};

export function emptyPage(): EditablePage {
  return {
    welcome: {},
    travel_train: {},
    travel_plane: {},
    travel_car: {},
    shuttle: {},
    dress_code: {},
    dress_text: {},
    dress_note: {},
    palette: [],
  };
}

export async function fetchEditableGuestPage(
  weddingId: string,
  sourceLocale: string,
): Promise<EditableGuestPage> {
  const supabase = getBrowserSupabase();
  const [pageRes, momentsRes, faqRes] = await Promise.all([
    supabase.from("guest_pages").select("*").eq("wedding_id", weddingId).maybeSingle(),
    supabase
      .from("guest_page_moments")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("day_offset", { ascending: true })
      .order("starts_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("guest_page_faq")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (pageRes.error) throw pageRes.error;
  if (momentsRes.error) throw momentsRes.error;
  if (faqRes.error) throw faqRes.error;

  const row = pageRes.data;
  const page = emptyPage();
  if (row) {
    for (const key of PAGE_TEXT_KEYS) page[key] = asText(row[key], sourceLocale);
    page.palette = Array.isArray(row.palette)
      ? (row.palette as Array<{ color?: unknown; name?: unknown }>)
          .filter((s) => typeof s?.color === "string")
          .map((s) => ({ color: s.color as string, name: asText(s.name, sourceLocale) }))
      : [];
  }

  return {
    page,
    moments: (momentsRes.data ?? []).map((m) => ({
      id: m.id,
      day_offset: m.day_offset,
      starts_at: m.starts_at ? m.starts_at.slice(0, 5) : "",
      title: asText(m.title, sourceLocale),
      place: asText(m.place, sourceLocale),
      note: asText(m.note, sourceLocale),
    })),
    faq: (faqRes.data ?? []).map((f) => ({
      id: f.id,
      question: asText(f.question, sourceLocale),
      answer: asText(f.answer, sourceLocale),
    })),
  };
}

/** Saves the page texts and palette (one row per wedding). Only the fields
 *  passed are written, so each editor saves its own part. */
export async function savePageFields(
  weddingId: string,
  fields: Partial<EditablePage>,
  sourceLocale: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const patch: Record<string, Json> = {};
  for (const key of PAGE_TEXT_KEYS) {
    if (key in fields) patch[key] = clean(fields[key] as LocalizedText, sourceLocale) as Json;
  }
  if (fields.palette) {
    patch.palette = fields.palette.map((s) => {
      const name = clean(s.name, sourceLocale);
      return name ? { color: s.color, name } : { color: s.color };
    }) as Json;
  }
  const { error } = await supabase
    .from("guest_pages")
    .upsert({ wedding_id: weddingId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "wedding_id" });
  if (error) throw error;
}

/** Replaces the weekend with `moments`: removed ones are deleted, the rest
 *  written. */
export async function saveMoments(
  weddingId: string,
  moments: EditableMoment[],
  previousIds: readonly string[],
  sourceLocale: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const keep = new Set(moments.map((m) => m.id));
  const removed = previousIds.filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await supabase.from("guest_page_moments").delete().in("id", removed);
    if (error) throw error;
  }
  if (!moments.length) return;
  const { error } = await supabase.from("guest_page_moments").upsert(
    moments.map((m) => ({
      id: m.id,
      wedding_id: weddingId,
      day_offset: m.day_offset,
      starts_at: m.starts_at || null,
      title: clean(m.title, sourceLocale) as Json,
      place: clean(m.place, sourceLocale) as Json,
      note: clean(m.note, sourceLocale) as Json,
    })),
  );
  if (error) throw error;
}

/** Replaces the questions with `faq`, in this order. */
export async function saveQuestions(
  weddingId: string,
  faq: EditableQuestion[],
  previousIds: readonly string[],
  sourceLocale: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const keep = new Set(faq.map((q) => q.id));
  const removed = previousIds.filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await supabase.from("guest_page_faq").delete().in("id", removed);
    if (error) throw error;
  }
  if (!faq.length) return;
  const { error } = await supabase.from("guest_page_faq").upsert(
    faq.map((q, i) => ({
      id: q.id,
      wedding_id: weddingId,
      question: clean(q.question, sourceLocale) as Json,
      answer: clean(q.answer, sourceLocale) as Json,
      sort_order: i,
    })),
  );
  if (error) throw error;
}
