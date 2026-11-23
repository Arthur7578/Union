"use client";

import { resolveText, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/**
 * The couple's questions, with their dress code first when they wrote one.
 * Nothing written yet: a short line rather than another wedding's answers.
 */
export function FaqSection({ content }: { content: GuestPageContent }) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);

  const dressCode = say(content.page?.dress_code);
  const dressAnswer = [say(content.page?.dress_text), say(content.page?.dress_note)].filter(Boolean).join(" ");
  const items = [
    ...(dressCode || dressAnswer
      ? [
          {
            key: "dress",
            q: fr ? "Quel est le dress code ?" : "What is the dress code?",
            a: [dressCode, dressAnswer].filter(Boolean).join(". "),
          },
        ]
      : []),
    ...content.faq
      .map((f) => ({ key: f.id, q: say(f.question), a: say(f.answer) }))
      .filter((f): f is { key: string; q: string; a: string } => Boolean(f.q && f.a)),
  ];

  return (
    <>
      <SectionHead
        title={fr ? "Questions fréquentes" : "Questions & answers"}
        lead={
          fr
            ? "Toutes les réponses pour faciliter ton organisation."
            : "Quick answers to help plan your trip and details about the day."
        }
      />
      {items.length ? (
        <div className="gh-faq">
          {items.map((item) => (
            <details key={item.key} className="gh-faq-item">
              <summary>
                <span>{item.q}</span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      ) : (
        <p className="gh-card-meta">
          {fr
            ? "Les mariés n'ont pas encore ajouté de questions. Une question ? Écris-leur directement."
            : "The couple hasn't added any questions yet. Something to ask? Write to them directly."}
        </p>
      )}
    </>
  );
}
