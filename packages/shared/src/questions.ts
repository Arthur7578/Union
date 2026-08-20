/**
 * A form's guest-facing question list — its types, and the reader that turns
 * whatever jsonb hands back into something safe to render.
 */

import { toLocalizedText, type LocalizedText, type StoredText } from "./localized";

/** One choice offered by a single/multi question.
 *
 *  `id` is what a guest's answer is stored as — never the label. A French
 *  guest picking "Végétarien" and an English one picking "Vegetarian" must
 *  land in the same bucket when the couple counts the answers, so the label
 *  is display-only and free to be reworded or translated at any time. */
export type RsvpQuestionOption = {
  id: string;
  label: LocalizedText;
};

/** One question in a form's guest-facing question list (stored on
 *  forms.questions). Titles and option labels are localized — read them with
 *  `resolveText()` rather than touching the map directly, so pre-migration
 *  rows (bare strings, `string[]` options) keep rendering. */
export type RsvpQuestion = {
  id: string;
  kind: "single" | "multi" | "short" | "comment";
  title: LocalizedText;
  required: boolean;
  options?: RsvpQuestionOption[];
};

/** A question exactly as jsonb hands it back: localized after the migration,
 *  bare strings before it. `normalizeQuestion()` collapses both into
 *  `RsvpQuestion`. */
export type StoredRsvpQuestion = Omit<RsvpQuestion, "title" | "options"> & {
  title: StoredText;
  options?: Array<RsvpQuestionOption | string>;
};


const QUESTION_KINDS = ["single", "multi", "short", "comment"] as const;

function isQuestionKind(value: unknown): value is RsvpQuestion["kind"] {
  return (
    typeof value === "string" &&
    (QUESTION_KINDS as readonly string[]).includes(value)
  );
}

/** A stable id for an option that predates ids — the label's position in the
 *  list, which is exactly what the normalising migration used, so an answer
 *  saved before the migration still matches its option after it. */
export function legacyOptionId(index: number): string {
  return `o${index}`;
}

/** Collapse one stored question into the localized shape the app renders.
 *  Accepts both the localized form and the bare-string form written before
 *  the migration; returns null for anything too malformed to show. */
export function normalizeQuestion(
  raw: unknown,
  sourceLocale: string,
): RsvpQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  if (typeof q.id !== "string" || !q.id) return null;
  const kind = isQuestionKind(q.kind) ? q.kind : "short";
  const question: RsvpQuestion = {
    id: q.id,
    kind,
    title: toLocalizedText(q.title as StoredText, sourceLocale),
    required: q.required === true,
  };
  if (kind !== "single" && kind !== "multi") return question;
  const options = Array.isArray(q.options) ? q.options : [];
  question.options = options.flatMap((opt, i) => {
    if (typeof opt === "string") {
      const label = toLocalizedText(opt, sourceLocale);
      return opt.trim() ? [{ id: legacyOptionId(i), label }] : [];
    }
    if (!opt || typeof opt !== "object" || Array.isArray(opt)) return [];
    const o = opt as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : legacyOptionId(i);
    return [{ id, label: toLocalizedText(o.label as StoredText, sourceLocale) }];
  });
  return question;
}

/** Pull a whole question list out of a jsonb column or an RPC payload. */
export function normalizeQuestions(
  raw: unknown,
  sourceLocale: string,
): RsvpQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => normalizeQuestion(q, sourceLocale))
    .filter((q): q is RsvpQuestion => q !== null);
}
