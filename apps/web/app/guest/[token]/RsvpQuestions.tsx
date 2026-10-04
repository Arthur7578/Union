"use client";

import { useState } from "react";
import { hasAnyAnswer, missingRequired } from "@/lib/formAnswers";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import type { Locale } from "@/lib/i18n";
import type { DBInvitation } from "./page";
import { G, T } from "@/lib/theme";
import { FormQuestionFields } from "./FormQuestionFields";

/** RSVP follow-up answers, keyed by person, for whichever RSVP form the modal
 *  has open. Saved answers are kept apart from the open modal's drafts so a
 *  second visit reopens on what was just submitted without a page reload. */
export function useRsvpAnswers(invitation: DBInvitation) {
  const [saved, setSaved] = useState<Record<string, Record<string, FormAnswers>>>(() => {
    const byForm: Record<string, Record<string, FormAnswers>> = {};
    for (const form of [invitation.rsvp_form, invitation.rsvp_reconfirmation]) {
      if (!form) continue;
      byForm[form.id] = {
        [invitation.guest.id]: form.answers ?? {},
        ...(form.companion_answers ?? {}),
      };
    }
    return byForm;
  });
  const [drafts, setDrafts] = useState<Record<string, FormAnswers>>({});
  const [personId, setPersonId] = useState(invitation.guest.id);

  /** Start the modal over on this form's saved answers, on the invited guest. */
  const reset = (formId: string | null) => {
    setDrafts(formId ? { ...(saved[formId] ?? {}) } : {});
    setPersonId(invitation.guest.id);
  };

  const patchDraft = (next: FormAnswers) =>
    setDrafts((prev) => ({ ...prev, [personId]: next }));

  /** Record these people's drafts as the form's submitted answers. */
  const markSaved = (formId: string, personIds: string[]) =>
    setSaved((prev) => ({
      ...prev,
      [formId]: {
        ...(prev[formId] ?? {}),
        ...Object.fromEntries(personIds.map((id) => [id, drafts[id] ?? {}])),
      },
    }));

  return { drafts, personId, setPersonId, reset, patchDraft, markSaved };
}

/** The RSVP block's questions, answered for each attending person. The person
 *  chips only appear when more than one person is coming. */
export function RsvpQuestions({
  questions,
  respondents,
  drafts,
  personId,
  selfId,
  locale,
  onSelectPerson,
  onChange,
}: {
  questions: RsvpQuestion[];
  respondents: Array<{ id: string; name: string }>;
  drafts: Record<string, FormAnswers>;
  personId: string;
  selfId: string;
  locale: Locale;
  onSelectPerson: (id: string) => void;
  onChange: (next: FormAnswers) => void;
}) {
  if (questions.length === 0 || respondents.length === 0) return null;

  return (
    <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 18, marginTop: 4 }}>
      {respondents.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
            {locale === "fr"
              ? "Répondez pour chaque personne qui vient."
              : "Answer for each person who is coming."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {respondents.map((person) => {
              const on = person.id === personId;
              const complete = missingRequired(questions, drafts[person.id]).length === 0
                && hasAnyAnswer(drafts[person.id]);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => onSelectPerson(person.id)}
                  style={{
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    background: on ? "var(--accent-light)" : T.white,
                    color: on ? "var(--primary)" : "var(--muted)",
                    borderRadius: 100,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {complete ? "✓ " : ""}
                  {person.id === selfId
                    ? locale === "fr" ? "Vous" : "You"
                    : person.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <FormQuestionFields
        questions={questions}
        answers={drafts[personId] ?? {}}
        locale={locale}
        onChange={onChange}
      />
    </div>
  );
}
