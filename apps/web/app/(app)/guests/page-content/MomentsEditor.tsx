"use client";

import { useId, useState } from "react";
import { MOMENT_DAY_OFFSETS, isTextEmpty, momentDate } from "@union/shared";
import { useT } from "@/lib/i18n/client";
import { saveMoments, type EditableMoment } from "@/lib/guestPageData";
import { EditorCard, ItemBox, LocalizedField, MiniButton, newId, useSave } from "./fields";

/**
 * Le week-end. Each moment sits a number of days from the wedding: its date
 * is computed from the wedding date, so it is never typed and moves with it.
 */
export function MomentsEditor({
  weddingId,
  eventDate,
  initial,
  locale,
  sourceLocale,
}: {
  weddingId: string;
  eventDate: string | null;
  initial: EditableMoment[];
  locale: string;
  sourceLocale: string;
}) {
  const t = useT().guests.pageContent;
  const [moments, setMoments] = useState<EditableMoment[]>(initial);
  const [savedIds, setSavedIds] = useState<string[]>(() => initial.map((m) => m.id));
  const [error, setError] = useState<string | null>(null);
  const { state, run } = useSave();
  const baseId = useId();

  const dayName = (offset: number) => {
    const label = offset === 0 ? t.dayOf : offset < 0 ? t.dayBefore(-offset) : t.dayAfter(offset);
    const iso = momentDate(eventDate, offset);
    if (!iso) return label;
    const date = new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return `${label} · ${date}`;
  };

  const set = (id: string, patch: Partial<EditableMoment>) =>
    setMoments((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const save = () => {
    if (moments.some((m) => isTextEmpty(m.title))) {
      setError(t.momentTitleMissing);
      return;
    }
    setError(null);
    // Saved in reading order, the order guests see.
    const ordered = [...moments].sort(
      (a, b) => a.day_offset - b.day_offset || a.starts_at.localeCompare(b.starts_at),
    );
    run(async () => {
      await saveMoments(weddingId, ordered, savedIds, sourceLocale);
      setMoments(ordered);
      setSavedIds(ordered.map((m) => m.id));
    });
  };

  return (
    <EditorCard id="pc-weekend" title={t.weekendTitle} lead={t.weekendLead} state={state} error={error} onSave={save}>
      {moments.length === 0 ? <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{t.noMoments}</p> : null}
      {moments.map((m, i) => {
        const dayId = `${baseId}-day-${i}`;
        const timeId = `${baseId}-time-${i}`;
        return (
          <ItemBox
            key={m.id}
            head={
              <>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {m.title[locale] && typeof m.title[locale] === "string" ? (m.title[locale] as string) : `${t.momentTitleLabel} ${i + 1}`}
                </span>
                <MiniButton label={`${t.removeMoment} ${i + 1}`} onClick={() => setMoments((prev) => prev.filter((x) => x.id !== m.id))}>
                  ×
                </MiniButton>
              </>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 0 }}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label htmlFor={dayId}>{t.dayLabel}</label>
                <select id={dayId} value={m.day_offset} onChange={(e) => set(m.id, { day_offset: Number(e.target.value) })}>
                  {MOMENT_DAY_OFFSETS.map((o) => (
                    <option key={o} value={o}>
                      {dayName(o)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 14, maxWidth: 200 }}>
                <label htmlFor={timeId}>{t.timeLabel}</label>
                <input id={timeId} type="time" value={m.starts_at} onChange={(e) => set(m.id, { starts_at: e.target.value })} />
              </div>
            </div>
            <LocalizedField
              label={t.momentTitleLabel}
              value={m.title}
              locale={locale}
              onChange={(title) => set(m.id, { title })}
              placeholder={t.momentTitlePlaceholder}
            />
            <LocalizedField
              label={t.placeLabel}
              value={m.place}
              locale={locale}
              onChange={(place) => set(m.id, { place })}
              placeholder={t.placePlaceholder}
            />
            <LocalizedField
              label={t.noteLabel}
              value={m.note}
              locale={locale}
              onChange={(note) => set(m.id, { note })}
              placeholder={t.notePlaceholder}
            />
          </ItemBox>
        );
      })}
      <div style={{ marginBottom: 12 }}>
        <MiniButton
          wide
          onClick={() =>
            setMoments((prev) => [
              ...prev,
              { id: newId(), day_offset: 0, starts_at: "", title: {}, place: {}, note: {} },
            ])
          }
        >
          {t.addMoment}
        </MiniButton>
      </div>
    </EditorCard>
  );
}
