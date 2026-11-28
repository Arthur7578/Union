"use client";

import { resolveText, type GuestPageContent, type StoredText } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n";
import { SectionHead } from "./SectionHead";

/** La tenue: the dress code, a word on it, the palette and a last line. */
export function DressSection({ content }: { content: GuestPageContent }) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const say = (value: StoredText) => resolveText(value, locale, LOCALES);
  const code = say(content.page?.dress_code);
  const text = say(content.page?.dress_text);
  const note = say(content.page?.dress_note);
  const palette = content.page?.palette ?? [];

  return (
    <>
      <SectionHead title={copy.dressTitle} />
      <div className="wp-dress">
        {code ? <p className="wp-dress-code">{code}</p> : null}
        {text ? <p>{text}</p> : null}
        {palette.length ? (
          <ul className="wp-swatches" aria-label={copy.palette}>
            {palette.map((s, i) => {
              const name = s.name ? say(s.name) : "";
              return (
                <li key={`${s.color}-${i}`}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  {name ? <span>{name}</span> : <span className="wp-sr">{s.color}</span>}
                </li>
              );
            })}
          </ul>
        ) : null}
        {note ? <p className="wp-dress-note">{note}</p> : null}
      </div>
    </>
  );
}
