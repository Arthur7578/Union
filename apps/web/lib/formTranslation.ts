import {
  isAutoTranslated,
  setAutoTextForLocale,
  textForLocale,
  type FormGuestCopy,
  type LocalizedText,
  type RsvpBlockCopy,
  type RsvpQuestion,
} from "@union/shared";
import type { Locale } from "./i18n";

/**
 * Machine-translating a form's guest-facing copy.
 *
 * Kept out of the form builder so the interesting decisions — what gets sent,
 * what gets overwritten, where each translation lands — are testable without
 * mounting a page or calling the model.
 */

/** One string to translate, addressed by a stable id so the response can be
 *  routed back to the exact slot it came from. */
export type TranslatableSlot = {
  id: string;
  text: string;
};

/** The three jsonb bags a form's guest-facing wording lives in. */
export type FormCopyDraft = {
  rsvpCopy: RsvpBlockCopy;
  guestCopy: FormGuestCopy;
  questions: RsvpQuestion[];
};

const RSVP_SLOTS = [
  "title",
  "subtitle",
  "label_attending",
  "label_maybe",
  "label_declined",
] as const;

const GUEST_SLOTS = ["title", "subtitle"] as const;

/**
 * Every slot worth translating from `from` into `to`.
 *
 * A slot qualifies when the source language has text and the target either
 * has none or holds a previous machine translation. Text a person typed in
 * the target language is never queued — the couple's own French wording
 * outranks anything the model would produce, and silently overwriting it
 * would make the button unusable for a bilingual couple.
 */
export function collectTranslatable(
  draft: FormCopyDraft,
  from: Locale,
  to: Locale,
): TranslatableSlot[] {
  const slots: TranslatableSlot[] = [];
  const consider = (id: string, value: LocalizedText | undefined) => {
    const source = textForLocale(value, from).trim();
    if (!source) return;
    const target = textForLocale(value, to).trim();
    if (target && !isAutoTranslated(value, to)) return;
    slots.push({ id, text: source });
  };

  for (const slot of RSVP_SLOTS) consider(`rsvp.${slot}`, draft.rsvpCopy[slot]);
  for (const slot of GUEST_SLOTS) consider(`guest.${slot}`, draft.guestCopy[slot]);
  for (const q of draft.questions) {
    consider(`question.${q.id}.title`, q.title);
    for (const option of q.options ?? []) {
      consider(`question.${q.id}.option.${option.id}`, option.label);
    }
  }
  return slots;
}

/**
 * Fold translations back into the draft, flagged as machine-generated so the
 * builder can badge them for review.
 *
 * Ids that no longer match anything are dropped rather than guessed at: the
 * couple may have deleted a question while the request was in flight, and a
 * translation with nowhere to go is not worth inventing a home for.
 */
export function applyTranslations(
  draft: FormCopyDraft,
  translations: Record<string, string>,
  from: Locale,
  to: Locale,
): FormCopyDraft {
  const rsvpCopy: RsvpBlockCopy = { ...draft.rsvpCopy };
  const guestCopy: FormGuestCopy = { ...draft.guestCopy };

  for (const slot of RSVP_SLOTS) {
    const text = translations[`rsvp.${slot}`];
    if (!text?.trim()) continue;
    rsvpCopy[slot] = setAutoTextForLocale(rsvpCopy[slot], to, text, from);
  }
  for (const slot of GUEST_SLOTS) {
    const text = translations[`guest.${slot}`];
    if (!text?.trim()) continue;
    guestCopy[slot] = setAutoTextForLocale(guestCopy[slot], to, text, from);
  }

  const questions = draft.questions.map((q) => {
    const titleText = translations[`question.${q.id}.title`];
    const next: RsvpQuestion = {
      ...q,
      title: titleText?.trim()
        ? setAutoTextForLocale(q.title, to, titleText, from)
        : q.title,
    };
    if (q.options) {
      next.options = q.options.map((option) => {
        const labelText = translations[`question.${q.id}.option.${option.id}`];
        if (!labelText?.trim()) return option;
        return {
          ...option,
          label: setAutoTextForLocale(option.label, to, labelText, from),
        };
      });
    }
    return next;
  });

  return { rsvpCopy, guestCopy, questions };
}

/** Ask the server to translate a batch. Returns id → translated text. */
export async function requestTranslations(
  slots: TranslatableSlot[],
  from: Locale,
  to: Locale,
  accessToken: string,
): Promise<Record<string, string>> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ from, to, items: slots }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    translations?: Record<string, string>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Couldn't translate this form.",
    );
  }
  return payload.translations ?? {};
}
