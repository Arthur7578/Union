"use client";

import { useLocale } from "@/lib/i18n/client";
import "./LocaleToggle.css";

/** EN · FR as quiet letter-spaced text, for the stationery-styled guest pages. */
export function LocaleToggle() {
  const { t, locale, locales, setLocale } = useLocale();
  return (
    <div className="da-lang" role="group" aria-label={t.lang.switchTo}>
      {locales.map((code) => (
        <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
