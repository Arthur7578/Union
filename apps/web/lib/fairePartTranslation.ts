import {
  FAIRE_PART_SLOTS,
  isAutoTranslated,
  setAutoTextForLocale,
  textForLocale,
  type FairePartCopy,
} from "@union/shared";
import type { TranslatableSlot } from "./formTranslation";
import type { Locale } from "./i18n";

/**
 * Machine-translating the faire-part's wording.
 *
 * Only wording the couple wrote in `from` is translated: a slot they left alone
 * keeps the app's own default in each language, which reads better than a
 * machine translation of the other one. A slot is queued when the target
 * language has no wording of the couple's own, or only an earlier machine
 * translation: text a person typed in the target language is never overwritten.
 */
export function collectTranslatable(
  copy: FairePartCopy,
  from: Locale,
  to: Locale,
): TranslatableSlot[] {
  const slots: TranslatableSlot[] = [];
  for (const slot of FAIRE_PART_SLOTS) {
    const value = copy[slot];
    const target = textForLocale(value, to).trim();
    if (target && !isAutoTranslated(value, to)) continue;
    const text = textForLocale(value, from).trim();
    if (text) slots.push({ id: slot, text });
  }
  return slots;
}

/** Fold translations back in, flagged as machine-generated for the couple to review. */
export function applyTranslations(
  copy: FairePartCopy,
  translations: Record<string, string>,
  from: Locale,
  to: Locale,
): FairePartCopy {
  const next: FairePartCopy = { ...copy };
  for (const slot of FAIRE_PART_SLOTS) {
    const text = translations[slot];
    if (!text?.trim()) continue;
    next[slot] = setAutoTextForLocale(copy[slot], to, text.trim(), from);
  }
  return next;
}
