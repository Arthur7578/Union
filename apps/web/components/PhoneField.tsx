"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  PHONE_COUNTRIES,
  dialCode,
  guessPhoneCountry,
  isPhoneCountry,
  isValidPhone,
  parseStoredPhone,
  toStoredPhone,
  type PhoneCountry,
} from "@union/shared";
import { T } from "@/lib/theme";
import { useLocale } from "@/lib/i18n/client";

const subscribeNever = () => () => {};

/**
 * The country of the visitor's browser language, or null. Only ever used to
 * pre-select something visible and changeable in an empty field, never
 * applied to a number silently. Null on the server and during hydration, so
 * server and client markup agree.
 */
export function useBrowserCountry(): PhoneCountry | null {
  const language = useSyncExternalStore(
    subscribeNever,
    () => navigator.language,
    () => null,
  );
  return guessPhoneCountry(language);
}

/**
 * A phone number is only useful if it says which country it is from: the
 * same digits belong to different people in different countries. This
 * field captures the country next to the number and hands the form a
 * single value to store, in E.164 (+33612345678), so nothing downstream
 * has to guess.
 *
 * `value` is what is stored. A stored value that already starts with "+"
 * shows its own country. One saved before countries were captured
 * (06 12 34 56 78) shows as typed, with a note, and is not rewritten
 * unless the person changes it.
 */
export function PhoneField({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  compact = false,
}: {
  id?: string;
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Narrow select, no hints: for tight grids of inputs. */
  compact?: boolean;
}) {
  const { t } = useLocale();
  const browserCountry = useBrowserCountry();

  const [initial] = useState(() => readValue(value));
  // undefined: nobody has chosen. A number that is already there then has no
  // country (null); an empty field starts from the browser's.
  const [picked, setPicked] = useState<PhoneCountry | null | undefined>(
    initial.country ?? undefined,
  );
  const [text, setText] = useState(initial.text);
  const [startedEmpty, setStartedEmpty] = useState(initial.text === "");
  // The stored value this field's own state reflects.
  const [synced, setSynced] = useState(value);

  // The form loaded or replaced the number (a guest fetched after the first
  // render, a merge pick): show it. A value this field itself just emitted
  // comes back equal to `synced` and is left alone.
  if (value !== synced) {
    const next = readValue(value);
    setSynced(value);
    setPicked(next.country ?? undefined);
    setText(next.text);
    setStartedEmpty(next.text === "");
  }

  const country: PhoneCountry | null =
    picked !== undefined ? picked : startedEmpty ? browserCountry : null;

  const emit = (nextCountry: PhoneCountry | null, nextText: string) => {
    const stored = toStoredPhone(nextCountry, nextText);
    setSynced(stored);
    onChange(stored);
  };

  const changeText = (next: string) => {
    let nextCountry = country;
    // A number that starts with "+" states its own country: show it.
    if (/^\s*(\+|00)/.test(next)) {
      const own = parseStoredPhone(toStoredPhone(country, next)).country;
      if (own) nextCountry = own;
    }
    setText(next);
    setPicked(nextCountry);
    emit(nextCountry, next);
  };

  const changeCountry = (code: string) => {
    const nextCountry = isPhoneCountry(code) ? code : null;
    setPicked(nextCountry);
    emit(nextCountry, text);
  };

  const typed = text.trim() !== "";
  const statesCountry = /^\s*(\+|00)/.test(text);
  // A number with no country is the problem to name, whether it was saved
  // that way or just typed that way; only a number that has one can be
  // "incomplete".
  const hint =
    typed && !country && !statesCountry
      ? t.common.phoneCountryMissing
      : typed && !isValidPhone(country, text)
        ? t.common.phoneInvalid
        : null;

  return (
    <div>
      <div style={{ display: "flex", gap: compact ? 6 : 8 }}>
        <CountrySelect
          value={country}
          onChange={changeCountry}
          style={{ flex: compact ? "0 0 84px" : "0 0 128px", paddingRight: 30 }}
        />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => changeText(e.target.value)}
          placeholder={placeholder ?? t.account.phoneLocalPlaceholder}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
      {!compact && hint && (
        <div
          role="note"
          style={{ fontSize: 12, color: T.amberInk, marginTop: 6 }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/** Every country, named in the reader's language, with its dial code. */
export function CountrySelect({
  value,
  onChange,
  style,
}: {
  value: PhoneCountry | null;
  onChange: (code: string) => void;
  style?: React.CSSProperties;
}) {
  const { locale, t } = useLocale();
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return PHONE_COUNTRIES.map((code) => ({
      code,
      label: `${names.of(code) ?? code} (${dialCode(code)})`,
    })).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale]);

  return (
    <select
      aria-label={t.common.phoneCountry}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      <option value="">{t.common.phoneChooseCountry}</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function readValue(stored: string): {
  country: PhoneCountry | null;
  text: string;
} {
  const parsed = parseStoredPhone(stored);
  return { country: parsed.country, text: parsed.national };
}
