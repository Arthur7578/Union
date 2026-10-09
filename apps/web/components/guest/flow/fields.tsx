"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { useFlow } from "./Flow";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type FlowOption = { id: string; label: React.ReactNode };

/**
 * Lettered choices. One answer: picking it blinks and moves on by itself.
 * Several answers: each tap toggles, OK moves on. The letter keys pick too.
 */
export function FlowChoices({
  options,
  value,
  onChange,
  multiple = false,
  advance = !multiple,
}: {
  options: FlowOption[];
  /** The picked id, or ids when `multiple`. */
  value: string | string[] | null | undefined;
  onChange: (id: string) => void;
  multiple?: boolean;
  /** Move on as soon as a choice is picked. */
  advance?: boolean;
}) {
  const flow = useFlow();
  const [blink, setBlink] = useState<string | null>(null);
  const picked = (id: string) => (Array.isArray(value) ? value.includes(id) : value === id);

  const pick = (id: string) => {
    if (!flow.active) return;
    onChange(id);
    setBlink(id);
    if (advance) flow.nextSoon();
  };

  // Typeform's shortcut: the option's letter picks it.
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const i = LETTERS.indexOf(e.key.toUpperCase());
      if (i < 0 || i >= options.length) return;
      e.preventDefault();
      pickRef.current(options[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options]);

  return (
    <div className="tf-choices" role="group">
      {options.map((opt, i) => {
        const on = picked(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            className={`tf-choice${on ? " is-on" : ""}${blink === opt.id ? " is-blink" : ""}`}
            aria-pressed={on}
            onClick={() => pick(opt.id)}
            onAnimationEnd={() => setBlink(null)}
          >
            <kbd className="tf-key" aria-hidden="true">
              {LETTERS[i]}
            </kbd>
            <span className="tf-choice-label">{opt.label}</span>
            <svg className="tf-tick" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5l3.2 3L13 4.5" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/** One-line answer, underlined, as large as the page allows. */
export function FlowText({
  value,
  onChange,
  placeholder,
  label,
  autoFocus = true,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name when the question alone is not enough (two fields). */
  label?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  const { t } = useLocale();
  return (
    <input
      className="tf-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t.guestFlow.typeHere}
      aria-label={label}
      autoComplete={autoComplete ?? "off"}
      data-autofocus={autoFocus ? true : undefined}
    />
  );
}

/** Free text that grows with the answer. Enter moves on; Shift+Enter breaks the line. */
export function FlowLongText({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <>
      <textarea
        ref={ref}
        className="tf-input tf-textarea"
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t.guestFlow.typeHere}
        data-autofocus
      />
      <p className="tf-shift">{t.guestFlow.shiftEnter}</p>
    </>
  );
}
