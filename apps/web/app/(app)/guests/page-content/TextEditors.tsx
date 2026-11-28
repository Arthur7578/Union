"use client";

import { useState } from "react";
import { PALETTE_MAX, type LocalizedText } from "@union/shared";
import { P, T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { savePageFields, type EditablePage, type EditableSwatch } from "@/lib/guestPageData";
import { EditorCard, LocalizedField, MiniButton, useSave } from "./fields";

type Common = {
  weddingId: string;
  initial: EditablePage;
  /** The language being written. */
  locale: string;
  /** The wedding's own language, where a bare legacy string would land. */
  sourceLocale: string;
};

/** Le mot: the couple's word to their guests. */
export function WelcomeEditor({ weddingId, initial, locale, sourceLocale }: Common) {
  const t = useT().guests.pageContent;
  const [welcome, setWelcome] = useState<LocalizedText>(initial.welcome);
  const { state, run } = useSave();
  return (
    <EditorCard
      id="pc-welcome"
      title={t.welcomeTitle}
      lead={t.welcomeLead}
      state={state}
      onSave={() => run(() => savePageFields(weddingId, { welcome }, sourceLocale))}
    >
      <LocalizedField
        label={t.welcomeLabel}
        value={welcome}
        locale={locale}
        onChange={setWelcome}
        placeholder={t.welcomePlaceholder}
        multiline
      />
    </EditorCard>
  );
}

/** Venir: train, plane, car, and the shuttle reserved for a yes. */
export function TravelEditor({ weddingId, initial, locale, sourceLocale }: Common) {
  const t = useT().guests.pageContent;
  const [train, setTrain] = useState<LocalizedText>(initial.travel_train);
  const [plane, setPlane] = useState<LocalizedText>(initial.travel_plane);
  const [car, setCar] = useState<LocalizedText>(initial.travel_car);
  const [shuttle, setShuttle] = useState<LocalizedText>(initial.shuttle);
  const { state, run } = useSave();
  return (
    <EditorCard
      id="pc-travel"
      title={t.travelTitle}
      lead={t.travelLead}
      state={state}
      onSave={() =>
        run(() =>
          savePageFields(
            weddingId,
            { travel_train: train, travel_plane: plane, travel_car: car, shuttle },
            sourceLocale,
          ),
        )
      }
    >
      <LocalizedField label={t.train} value={train} locale={locale} onChange={setTrain} placeholder={t.trainPlaceholder} multiline />
      <LocalizedField label={t.plane} value={plane} locale={locale} onChange={setPlane} placeholder={t.planePlaceholder} multiline />
      <LocalizedField label={t.car} value={car} locale={locale} onChange={setCar} placeholder={t.carPlaceholder} multiline />
      <LocalizedField
        label={t.shuttle}
        value={shuttle}
        locale={locale}
        onChange={setShuttle}
        placeholder={t.shuttlePlaceholder}
        hint={t.shuttleHint}
        multiline
      />
    </EditorCard>
  );
}

/** La tenue: dress code, a few words, a last line, and the palette. */
export function DressEditor({ weddingId, initial, locale, sourceLocale }: Common) {
  const t = useT().guests.pageContent;
  const [code, setCode] = useState<LocalizedText>(initial.dress_code);
  const [text, setText] = useState<LocalizedText>(initial.dress_text);
  const [note, setNote] = useState<LocalizedText>(initial.dress_note);
  const [palette, setPalette] = useState<EditableSwatch[]>(initial.palette);
  const { state, run } = useSave();

  const setSwatch = (i: number, patch: Partial<EditableSwatch>) =>
    setPalette((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <EditorCard
      id="pc-dress"
      title={t.dressTitle}
      lead={t.dressLead}
      state={state}
      onSave={() =>
        run(() =>
          savePageFields(
            weddingId,
            { dress_code: code, dress_text: text, dress_note: note, palette },
            sourceLocale,
          ),
        )
      }
    >
      <LocalizedField label={t.dressCode} value={code} locale={locale} onChange={setCode} placeholder={t.dressCodePlaceholder} />
      <LocalizedField label={t.dressText} value={text} locale={locale} onChange={setText} placeholder={t.dressTextPlaceholder} multiline />
      <LocalizedField label={t.dressNote} value={note} locale={locale} onChange={setNote} placeholder={t.dressNotePlaceholder} />

      <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{t.palette}</div>
      <div style={{ fontSize: 12, color: T.faint, marginBottom: 10 }}>{t.paletteHint(PALETTE_MAX)}</div>
      {palette.map((s, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 44px", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            type="color"
            aria-label={`${t.colourValue} ${i + 1}`}
            value={s.color}
            onChange={(e) => setSwatch(i, { color: e.target.value.toUpperCase() })}
            style={{ width: 52, height: 44, padding: 2, border: `1px solid ${T.line3}`, borderRadius: 10, background: T.white }}
          />
          <input
            type="text"
            lang={locale}
            aria-label={`${t.colourName} ${i + 1}`}
            placeholder={t.colourName}
            value={typeof s.name[locale] === "string" ? (s.name[locale] as string) : ""}
            onChange={(e) => {
              const name = { ...s.name };
              if (e.target.value.trim()) name[locale] = e.target.value;
              else delete name[locale];
              setSwatch(i, { name });
            }}
          />
          <MiniButton label={`${t.removeColour} ${i + 1}`} onClick={() => setPalette((prev) => prev.filter((_, j) => j !== i))}>
            ×
          </MiniButton>
        </div>
      ))}
      {palette.length < PALETTE_MAX ? (
        <div style={{ marginBottom: 12 }}>
          <MiniButton wide onClick={() => setPalette((prev) => [...prev, { color: P.sage, name: {} }])}>
            {t.addColour}
          </MiniButton>
        </div>
      ) : null}
    </EditorCard>
  );
}
