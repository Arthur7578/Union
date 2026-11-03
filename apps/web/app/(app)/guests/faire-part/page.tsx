"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  FAIRE_PART_FIELDS,
  FAIRE_PART_SLOTS,
  AUTO_TRANSLATED_KEY,
  isAutoTranslated,
  setTextForLocale,
  textForLocale,
  type FairePartCopy,
  type FairePartField,
  type FairePartSlot,
  type Wedding,
} from "@union/shared";
import { BackHeader } from "@/components/BackHeader";
import { FairePartFaces } from "@/components/guest/FairePartFaces";
import "@/components/guest/FairePartEnvelope.css";
import { Button, Card, Loading, SectionLabel } from "@/components/ui";
import { updateWedding } from "@/lib/data";
import {
  fairePartFields,
  fairePartLines,
  readFairePartCopy,
  unknownFields,
} from "@/lib/fairePart";
import {
  applyTranslations,
  collectTranslatable,
} from "@/lib/fairePartTranslation";
import { requestWeddingTranslations } from "@/lib/formTranslation";
import { guestPlaceFields } from "@/lib/guestAddress";
import { LOCALES, getDictionary, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";

/**
 * When the last save went through. The app's layout swaps every page for a
 * loading screen while the wedding reloads, which remounts the editor and
 * drops its state, so "Saved" has to be remembered outside it.
 */
let lastSavedAt = 0;
const SAVED_NOTE_MS = 6000;

const FRONT: FairePartSlot[] = ["front_intro", "front_dates", "front_place"];
const BACK: FairePartSlot[] = [
  "greeting",
  "moments",
  "invite",
  "hope",
  "closing",
  "signature",
];

export default function FairePartPage() {
  const { wedding, refresh } = useWedding();
  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );
  return <FairePartEditor key={wedding.id} wedding={wedding} refresh={refresh} />;
}

/** Drop slots that hold nothing, so the column only carries what the couple wrote. */
function compact(copy: FairePartCopy): FairePartCopy {
  const out: FairePartCopy = {};
  for (const slot of FAIRE_PART_SLOTS) {
    const value = copy[slot];
    if (!value) continue;
    const hasText = Object.keys(value).some(
      (k) => k !== AUTO_TRANSLATED_KEY && typeof value[k] === "string" && value[k]!.trim(),
    );
    if (hasText) out[slot] = value;
  }
  return out;
}

function FairePartEditor({
  wedding,
  refresh,
}: {
  wedding: Wedding;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const e = t.fairePartEditor;
  const initialLocale: Locale = (LOCALES as string[]).includes(wedding.default_locale)
    ? (wedding.default_locale as Locale)
    : "en";

  const [saved, setSaved] = useState<FairePartCopy>(() => readFairePartCopy(wedding.faire_part_copy));
  const [copy, setCopy] = useState<FairePartCopy>(saved);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [focused, setFocused] = useState<FairePartSlot | null>(null);
  const [asGuest, setAsGuest] = useState<"personal" | "group">("personal");
  const [previewName, setPreviewName] = useState(locale === "fr" ? "Léa" : "Lea");
  const [busy, setBusy] = useState<"save" | "translate" | null>(null);
  const [note, setNote] = useState<string | null>(() =>
    Date.now() - lastSavedAt < SAVED_NOTE_MS ? e.saved : null,
  );
  const [error, setError] = useState<string | null>(null);
  const areas = useRef<Partial<Record<FairePartSlot, HTMLTextAreaElement | null>>>({});

  const dirty = JSON.stringify(compact(copy)) !== JSON.stringify(compact(saved));
  const other = LOCALES.find((l) => l !== locale) ?? locale;
  const languageName = (l: Locale) => t.lang[l];

  const write = (slot: FairePartSlot, text: string) => {
    setNote(null);
    setCopy((prev) => ({ ...prev, [slot]: setTextForLocale(prev[slot], locale, text) }));
  };

  const insertField = (field: FairePartField) => {
    const slot = focused ?? "invite";
    const area = areas.current[slot];
    const value = textForLocale(copy[slot], locale);
    const token = `{{${field}}}`;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    write(slot, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const translate = async () => {
    setBusy("translate");
    setNote(null);
    setError(null);
    try {
      const slots = collectTranslatable(copy, locale, other);
      if (slots.length === 0) {
        const written = FAIRE_PART_SLOTS.some((s) => textForLocale(copy[s], locale).trim());
        setNote(written ? e.translateNothing(languageName(other)) : e.translateNoSource(languageName(locale)));
        return;
      }
      const {
        data: { session },
      } = await getBrowserSupabase().auth.getSession();
      if (!session?.access_token) throw new Error(e.signedOut);
      const translations = await requestWeddingTranslations(
        wedding.id,
        slots,
        locale,
        other,
        session.access_token,
      );
      const count = Object.keys(translations).length;
      setCopy((prev) => applyTranslations(prev, translations, locale, other));
      setLocale(other);
      setNote(e.translateDone(count, languageName(other)));
    } catch (err) {
      setError(err instanceof Error ? err.message : e.translateError);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setNote(null);
    setError(null);
    try {
      const next = compact(copy);
      await updateWedding(wedding.id, { faire_part_copy: next as Wedding["faire_part_copy"] });
      lastSavedAt = Date.now();
      await refresh();
      setSaved(next);
      setCopy(next);
      setNote(e.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : e.saveError);
    } finally {
      setBusy(null);
    }
  };

  // What a guest would see: the wedding's real details, through the same
  // disclosure rules the invitation applies to them.
  const ctx = useMemo(
    () => ({
      guestFirstName: asGuest === "personal" ? previewName : "",
      partnerOne: wedding.partner_one,
      partnerTwo: wedding.partner_two,
      eventDate: wedding.event_date,
      place: guestPlaceFields({
        address_visibility: wedding.address_visibility,
        venue_name: wedding.venue_name,
        address: {
          line: wedding.address_line,
          postal_code: wedding.address_postal_code,
          city: wedding.address_city,
          area: wedding.address_area,
          country: wedding.address_country,
        },
      }),
    }),
    [asGuest, previewName, wedding],
  );
  const lines = fairePartLines(copy, ctx, locale);
  const values = fairePartFields(ctx, locale);

  const renderSlot = (slot: FairePartSlot) => {
    const value = textForLocale(copy[slot], locale);
    const unknown = unknownFields(value);
    const defaultText = getDictionary(locale).welcome.copy[slot];
    return (
      <div className="field" key={slot} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <label htmlFor={`fp-${slot}`} style={{ marginBottom: 0 }}>
            {e.slots[slot]}
          </label>
          {isAutoTranslated(copy[slot], locale) && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.accentInk,
              }}
            >
              {e.auto}
            </span>
          )}
          {value && (
            <button
              type="button"
              className="u-link"
              onClick={() => write(slot, "")}
              style={{ marginLeft: "auto", fontSize: 12, color: T.muted2 }}
            >
              {e.reset}
            </button>
          )}
        </div>
        <textarea
          id={`fp-${slot}`}
          ref={(el) => {
            areas.current[slot] = el;
          }}
          rows={slot === "invite" || slot === "hope" || slot === "moments" ? 3 : 2}
          value={value}
          placeholder={defaultText}
          onFocus={() => setFocused(slot)}
          onChange={(ev) => write(slot, ev.target.value)}
          maxLength={600}
          aria-describedby={`fp-${slot}-note`}
        />
        <div id={`fp-${slot}-note`} style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
          {unknown.length > 0 ? (
            <span style={{ color: T.danger }}>{e.unknownField(unknown.join(", "))}</span>
          ) : value ? null : (
            e.defaultWording
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="u-main">
      <BackHeader title={e.title} subtitle={e.subtitle} fallback="/guests" />

      <div
        role="group"
        aria-label={e.languageLabel}
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}
      >
        {LOCALES.map((l) => (
          <Button
            key={l}
            type="button"
            variant={l === locale ? "primary" : "secondary"}
            onClick={() => setLocale(l)}
            aria-pressed={l === locale}
            style={{ minHeight: 38, padding: "0 16px", fontSize: 13 }}
          >
            {languageName(l)}
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={translate}
          style={{ minHeight: 38, padding: "0 14px", fontSize: 13, marginLeft: "auto" }}
        >
          {busy === "translate" ? e.translating : e.translateTo(languageName(other))}
        </Button>
      </div>

      <div className="faire-part-layout" style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div>
          <SectionLabel style={{ marginTop: 0 }}>{e.fieldsTitle}</SectionLabel>
          <Card>
            <div style={{ fontSize: 12.5, color: T.muted2, marginBottom: 10 }}>{e.fieldsHint}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FAIRE_PART_FIELDS.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => insertField(field)}
                  title={`${e.fields[field]}${values[field] ? ` — ${values[field]}` : ""}`}
                  style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: 999,
                    background: T.white,
                    padding: "5px 11px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: T.ink,
                  }}
                >
                  {`{{${field}}}`}
                </button>
              ))}
            </div>
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", fontSize: 12, color: T.muted2 }}>
              {FAIRE_PART_FIELDS.map((field) => (
                <li key={field} style={{ marginBottom: 2 }}>
                  <code>{field}</code> — {e.fields[field]}
                  {values[field] ? <> : <em>{values[field]}</em></> : null}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 12, color: T.muted2, marginTop: 10 }}>{e.fieldsSyntax}</div>
          </Card>

          <SectionLabel>{e.front}</SectionLabel>
          <Card>{FRONT.map(renderSlot)}</Card>
          <SectionLabel>{e.back}</SectionLabel>
          <Card>{BACK.map(renderSlot)}</Card>

          {error && (
            <div className="error" role="alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          {note && (
            <div role="status" style={{ marginTop: 12, fontSize: 13, color: T.muted2 }}>
              {note}
            </div>
          )}
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || busy !== null}
            style={{ width: "100%", marginTop: 14 }}
          >
            {busy === "save" ? e.saving : e.save}
          </Button>
        </div>

        <div>
          <SectionLabel style={{ marginTop: 0 }}>{e.previewTitle}</SectionLabel>
          <Card>
            <div className="field" style={{ marginBottom: 10 }}>
              <label htmlFor="fp-as">{e.previewAs}</label>
              <select
                id="fp-as"
                value={asGuest}
                onChange={(ev) => setAsGuest(ev.target.value as "personal" | "group")}
              >
                <option value="personal">{e.previewPersonal}</option>
                <option value="group">{e.previewGroup}</option>
              </select>
            </div>
            {asGuest === "personal" && (
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="fp-name">{e.previewName}</label>
                <input
                  id="fp-name"
                  type="text"
                  value={previewName}
                  onChange={(ev) => setPreviewName(ev.target.value)}
                />
              </div>
            )}
            {(["front", "back"] as const).map((side) => (
              <div key={side} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.label, marginBottom: 6 }}>
                  {side === "front" ? e.previewFront : e.previewBack}
                </div>
                <div className="fp-root fp-preview" aria-label={side === "front" ? e.previewFront : e.previewBack}>
                  <article className="card">
                    <FairePartFaces
                      partnerOne={wedding.partner_one}
                      partnerTwo={wedding.partner_two}
                      lines={lines}
                      side={side}
                    />
                  </article>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>{e.previewNote}</div>
          </Card>
        </div>
      </div>

      <style>{`@media (min-width: 980px){.faire-part-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;align-items:start}.faire-part-layout > div:last-child{position:sticky;top:16px}}`}</style>
    </main>
  );
}

