"use client";

import React, { useId } from "react";
import { setTextForLocale, textForLocale, type LocalizedText } from "@union/shared";
import { T } from "@/lib/theme";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * One couple-written text, bound to the language being written. An empty
 * field in this language shows its placeholder rather than echoing the other
 * language, as in the form builder.
 */
export function LocalizedField({
  label,
  value,
  locale,
  onChange,
  placeholder,
  multiline,
  hint,
}: {
  label: string;
  value: LocalizedText;
  locale: string;
  onChange: (next: LocalizedText) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const id = useId();
  const text = textForLocale(value, locale);
  const set = (raw: string) => onChange(setTextForLocale(value, locale, raw));
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          lang={locale}
          rows={4}
          value={text}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          style={{ resize: "vertical" }}
        />
      ) : (
        <input
          id={id}
          lang={locale}
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {hint ? <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * A part of the page with its own Save button. Saving publishes straight
 * away (issue #107 keeps the draft / publish proposal for later).
 */
export function EditorCard({
  id,
  title,
  lead,
  children,
  onSave,
  state,
  error,
  note,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
  onSave: () => void;
  state: SaveState;
  /** A validation message, shown instead of saving. */
  error?: string | null;
  /** Shown under the lead, e.g. where this part appears. */
  note?: string;
}) {
  const t = useT().guests.pageContent;
  const headingId = `${id}-h`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      style={{
        background: T.surface,
        border: `1px solid ${T.line3}`,
        borderRadius: 18,
        padding: "16px 16px 14px",
        marginBottom: 16,
      }}
    >
      <h2 id={headingId} className="u-serif" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: T.ink }}>
        {title}
      </h2>
      <p style={{ margin: "4px 0 14px", fontSize: 13.5, color: T.muted }}>{lead}</p>
      {note ? <p style={{ margin: "-8px 0 14px", fontSize: 12, color: T.faint }}>{note}</p> : null}
      {children}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
        <Button onClick={onSave} disabled={state === "saving"} style={{ minWidth: 140 }}>
          {state === "saving" ? t.saving : t.save}
        </Button>
        <span role="status" aria-live="polite" style={{ fontSize: 13, color: error || state === "error" ? T.accentInk : T.greenInk }}>
          {error ? error : state === "saved" ? t.saved : state === "error" ? t.saveError : ""}
        </span>
      </div>
    </section>
  );
}

/** A small secondary button (add, remove, move). */
export function MiniButton({
  children,
  onClick,
  label,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        minHeight: 44,
        minWidth: 44,
        width: wide ? "100%" : undefined,
        padding: "0 12px",
        borderRadius: 12,
        border: wide ? `1.5px dashed ${T.accentBorder}` : `1px solid ${T.line3}`,
        background: "transparent",
        color: wide ? T.accentInk : T.ink2,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** A repeated item (a moment, a question) inside an editor. */
export function ItemBox({ children, head }: { children: React.ReactNode; head: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${T.line3}`,
        borderRadius: 14,
        padding: "10px 12px 2px",
        marginBottom: 12,
        background: T.white,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {head}
      </div>
      {children}
    </div>
  );
}

/** Tracks a save: idle → saving → saved (fades back) or error. */
export function useSave() {
  const [state, setState] = React.useState<SaveState>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setState("saving");
    try {
      await fn();
      setState("saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      console.error("Failed to save guest page content:", e);
      setState("error");
    }
  };
  return { state, run };
}

/** A row id made in the browser, so a new moment or question can be written
 *  with the others in one upsert. The column is a uuid. */
export function newId(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
