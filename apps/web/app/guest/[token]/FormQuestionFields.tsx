"use client";

import { coupleText } from "@/lib/i18n/text";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import type { Locale } from "@/lib/i18n";

/** One field per question, for the RSVP modal and custom forms alike. */
export function FormQuestionFields({
  questions,
  answers,
  locale,
  onChange,
}: {
  questions: RsvpQuestion[];
  answers: FormAnswers;
  locale: Locale;
  onChange: (next: FormAnswers) => void;
}) {
  return questions.map((question) => (
    <div className="field" key={question.id}>
      <label>
        {coupleText(question.title, locale) ?? ""}
        {question.required ? " *" : ` (${locale === "fr" ? "optionnel" : "optional"})`}
      </label>

      {(question.kind === "single" || question.kind === "multi") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(question.options ?? []).map((option) => {
            const current = answers[question.id];
            const selected = question.kind === "single"
              ? current === option.id
              : Array.isArray(current) && current.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (question.kind === "single") {
                    onChange({ ...answers, [question.id]: option.id });
                    return;
                  }
                  const list = Array.isArray(current) ? current : [];
                  onChange({
                    ...answers,
                    [question.id]: list.includes(option.id)
                      ? list.filter((id) => id !== option.id)
                      : [...list, option.id],
                  });
                }}
                className={`choice-btn ${selected ? "selected-yes" : ""}`}
                style={{ justifyContent: "flex-start", textAlign: "left" }}
              >
                {selected ? "✓ " : ""}{coupleText(option.label, locale) ?? ""}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "short" && (
        <input
          type="text"
          value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""}
          onChange={(event) => onChange({ ...answers, [question.id]: event.target.value })}
        />
      )}

      {question.kind === "comment" && (
        <textarea
          value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""}
          onChange={(event) => onChange({ ...answers, [question.id]: event.target.value })}
          rows={3}
        />
      )}
    </div>
  ));
}
