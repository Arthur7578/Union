"use client";

import { paragraphs, resolveText, type GuestPageContent } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/** Le mot: the couple's own text, signed with their names, and the countdown. */
export function WordSection({
  content,
  coupleNames,
  daysLeft,
}: {
  content: GuestPageContent;
  coupleNames: string;
  /** Whole days until the wedding; null without a date or before it is known. */
  daysLeft: number | null;
}) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const text = paragraphs(resolveText(content.page?.welcome, locale, LOCALES));

  return (
    <>
      <SectionHead title={copy.wordTitle} />
      <div className="wp-word">
        {text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="wp-sign">{coupleNames}</p>
      </div>
      {daysLeft !== null ? (
        <p className="wp-count">
          {daysLeft > 0 ? <b>{daysLeft}</b> : null}
          <span>{copy.countdown(daysLeft)}</span>
        </p>
      ) : null}
    </>
  );
}
