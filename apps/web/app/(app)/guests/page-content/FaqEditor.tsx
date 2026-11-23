"use client";

import { useState } from "react";
import {
  isTextEmpty,
  resolveText,
  suggestedChildrenAnswer,
  suggestedContactAnswer,
  type LocalizedText,
  type Wedding,
} from "@union/shared";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";
import { saveQuestions, type EditableQuestion } from "@/lib/guestPageData";
import { EditorCard, ItemBox, LocalizedField, MiniButton, newId, useSave } from "./fields";

type Suggestion = { key: string; label: string; question: LocalizedText; answer: LocalizedText };

/**
 * Questions. Answers the app already knows (children, from the guest
 * permissions; a contact, from the organiser's profile) are offered as
 * pre-filled suggestions rather than typed again.
 */
export function FaqEditor({
  weddingId,
  wedding,
  profile,
  initial,
  locale,
  sourceLocale,
}: {
  weddingId: string;
  wedding: Pick<Wedding, "allow_guests_add_children" | "max_children_per_guest">;
  profile: { full_name: string | null; phone: string | null } | null;
  initial: EditableQuestion[];
  locale: string;
  sourceLocale: string;
}) {
  const t = useT().guests.pageContent;
  const [faq, setFaq] = useState<EditableQuestion[]>(initial);
  const [savedIds, setSavedIds] = useState<string[]>(() => initial.map((q) => q.id));
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { state, run } = useSave();

  const contact = profile ? suggestedContactAnswer(profile) : null;
  const suggestions: Suggestion[] = [
    { key: "children", label: t.suggestChildren, question: t.suggestChildrenQuestion, answer: suggestedChildrenAnswer(wedding) },
    ...(contact ? [{ key: "contact", label: t.suggestContact, question: t.suggestContactQuestion, answer: contact }] : []),
  ];
  // A suggestion disappears once a question with the same wording exists.
  const asked = new Set(faq.map((q) => resolveText(q.question, locale)?.toLowerCase()));
  const open = suggestions.filter((s) => !asked.has(resolveText(s.question, locale)?.toLowerCase()));

  const set = (id: string, patch: Partial<EditableQuestion>) =>
    setFaq((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const save = () => {
    if (faq.some((q) => isTextEmpty(q.question) || isTextEmpty(q.answer))) {
      setError(t.faqIncomplete);
      return;
    }
    setError(null);
    run(async () => {
      await saveQuestions(weddingId, faq, savedIds, sourceLocale);
      setSavedIds(faq.map((q) => q.id));
    });
  };

  return (
    <EditorCard id="pc-faq" title={t.faqTitle} lead={t.faqLead} state={state} error={error} onSave={save}>
      {faq.length === 0 ? <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{t.noQuestions}</p> : null}
      {faq.map((q, i) => (
        <ItemBox
          key={q.id}
          head={
            <>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {t.question} {i + 1}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                {i > 0 ? (
                  <MiniButton
                    label={`${t.moveUp} · ${t.question} ${i + 1}`}
                    onClick={() =>
                      setFaq((prev) => {
                        const next = [...prev];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return next;
                      })
                    }
                  >
                    ↑
                  </MiniButton>
                ) : null}
                <MiniButton label={`${t.removeQuestion} ${i + 1}`} onClick={() => setFaq((prev) => prev.filter((x) => x.id !== q.id))}>
                  ×
                </MiniButton>
              </span>
            </>
          }
        >
          <LocalizedField label={t.question} value={q.question} locale={locale} onChange={(question) => set(q.id, { question })} />
          <LocalizedField
            label={t.answer}
            value={q.answer}
            locale={locale}
            onChange={(answer) => set(q.id, { answer })}
            multiline
            hint={suggested.has(q.id) ? t.suggestedFrom : undefined}
          />
        </ItemBox>
      ))}
      <div style={{ marginBottom: 12 }}>
        <MiniButton wide onClick={() => setFaq((prev) => [...prev, { id: newId(), question: {}, answer: {} }])}>
          {t.addQuestion}
        </MiniButton>
      </div>
      {open.length ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, marginBottom: 6 }}>{t.suggestions}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {open.map((s) => (
              <MiniButton
                key={s.key}
                onClick={() => {
                  const id = newId();
                  setFaq((prev) => [...prev, { id, question: { ...s.question }, answer: { ...s.answer } }]);
                  setSuggested((prev) => new Set(prev).add(id));
                }}
              >
                + {s.label}
              </MiniButton>
            ))}
          </div>
        </div>
      ) : null}
    </EditorCard>
  );
}
