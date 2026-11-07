"use client";

import { resolveText, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/**
 * Questions: the couple's own, as written. The dress code has its own part
 * of the page (La tenue). The page leaves this part out while it is empty.
 */
export function FaqSection({ content }: { content: GuestPageContent }) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);

  const items = content.faq
    .map((f) => ({ key: f.id, q: say(f.question), a: say(f.answer) }))
    .filter((f): f is { key: string; q: string; a: string } => Boolean(f.q && f.a));

  return (
    <>
      <SectionHead title={copy.faqTitle} lead={copy.faqLead} />
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
    </>
  );
}
