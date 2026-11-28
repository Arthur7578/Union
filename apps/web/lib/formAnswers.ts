/**
 * Reading a guest's form answers back, for the organiser.
 *
 * What a guest submits is deliberately terse: `{ "<question id>": "<option
 * id>" }`. Option *ids* rather than labels is what makes a choice count the
 * same whatever language it was picked in — but it also means a stored answer
 * is unreadable on its own. It only becomes an answer again when read against
 * the form's current questions, which is what this module does.
 *
 * Everything here tolerates drift, because forms get edited after people have
 * answered them:
 *
 *  * A question that has since been deleted still has its answer shown — as
 *    an orphan, so a caterer reading the page sees "vegetarian" rather than
 *    nothing at all just because the couple reworded their form afterwards.
 *  * An option id nobody recognises renders as the raw id rather than being
 *    dropped: something was chosen, and silently showing an empty answer
 *    would be a worse lie than showing an ugly one.
 *  * A question with no answer is kept in the list, marked unanswered, so
 *    "they skipped the allergies question" is visible instead of absent.
 */

import { coupleText } from "@/lib/i18n/text";
import type { Locale } from "@/lib/i18n";
import type { FormAnswers, RsvpQuestion } from "@union/shared";

/** One question and what this guest said to it, ready to render. */
export type ReadableAnswer = {
  /** Question id, or the raw answer key for an orphaned answer. */
  key: string;
  /** The question as the organiser worded it, in their own language. */
  question: string;
  /** What the guest answered — null when they didn't. */
  answer: string | null;
  /** True when the answer has no question left in the form to belong to. */
  orphaned: boolean;
};

/** The label of one chosen option, or the raw id when the option is gone. */
function optionLabel(
  question: RsvpQuestion,
  optionId: string,
  locale: Locale,
): string {
  const option = (question.options ?? []).find((o) => o.id === optionId);
  if (!option) return optionId;
  return coupleText(option.label, locale) ?? optionId;
}

/** One stored value as text: choices resolved to their labels, typed answers
 *  as typed. Null when the guest left it empty. */
function answerText(
  question: RsvpQuestion,
  value: FormAnswers[string] | undefined,
  locale: Locale,
): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const labels = value
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((id) => optionLabel(question, id, locale));
    return labels.length ? labels.join(", ") : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Free-text answers are the guest's own words; only choices are ids.
  if (question.kind === "single" || question.kind === "multi") {
    return optionLabel(question, trimmed, locale);
  }
  return trimmed;
}

/**
 * A form's questions paired with this guest's answers, in the order the form
 * asks them — then any answer whose question no longer exists.
 */
export function readableAnswers(
  questions: RsvpQuestion[],
  answers: FormAnswers | null | undefined,
  locale: Locale,
): ReadableAnswer[] {
  const stored: FormAnswers =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? answers
      : {};

  const rows: ReadableAnswer[] = questions.map((q) => ({
    key: q.id,
    question: coupleText(q.title, locale) ?? "(untitled question)",
    answer: answerText(q, stored[q.id], locale),
    orphaned: false,
  }));

  const known = new Set(questions.map((q) => q.id));
  for (const [key, value] of Object.entries(stored)) {
    if (known.has(key)) continue;
    // No question left to read it against, so the value can only be shown as
    // it was stored — an option id here is genuinely all that survives.
    const text = Array.isArray(value)
      ? value.filter((v) => typeof v === "string" && v.trim()).join(", ")
      : typeof value === "string"
        ? value.trim()
        : "";
    if (!text) continue;
    rows.push({
      key,
      question: "Answer to a question you've since removed",
      answer: text,
      orphaned: true,
    });
  }

  return rows;
}

/** How many of a form's questions this guest actually answered — the
 *  "2 of 5" line, which is more honest on a page than a bare "answered". */
export function answeredCount(rows: ReadableAnswer[]): number {
  return rows.filter((r) => !r.orphaned && r.answer !== null).length;
}

/** True when this set of answers holds anything at all.
 *
 *  What "they didn't answer for this person" means, mechanically. A guest
 *  answering a per-person form for themselves and one of three children has
 *  not declined to answer for the other two — they simply haven't, and an
 *  untouched person must not be submitted as a row of blanks that reads like
 *  a considered "no preference". */
export function hasAnyAnswer(answers: FormAnswers | undefined | null): boolean {
  if (!answers) return false;
  return Object.values(answers).some((value) =>
    Array.isArray(value)
      ? value.some((v) => typeof v === "string" && v.trim() !== "")
      : typeof value === "string" && value.trim() !== "",
  );
}

/** The required questions this set of answers leaves empty, in form order.
 *  Returned as the questions themselves so a caller can name what's missing
 *  rather than only that something is. */
export function missingRequired(
  questions: RsvpQuestion[],
  answers: FormAnswers | undefined | null,
): RsvpQuestion[] {
  const stored = answers ?? {};
  return questions.filter((q) => {
    if (!q.required) return false;
    const value = stored[q.id];
    if (Array.isArray(value)) {
      return !value.some((v) => typeof v === "string" && v.trim() !== "");
    }
    return typeof value !== "string" || value.trim() === "";
  });
}
