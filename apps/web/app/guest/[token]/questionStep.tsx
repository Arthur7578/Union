"use client";

import type { FormAnswers, RsvpQuestion } from "@union/shared";
import type { FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices, FlowLongText, FlowText } from "@/components/guest/flow/fields";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { coupleText } from "@/lib/i18n/text";

const answered = (value: FormAnswers[string] | undefined) =>
  Array.isArray(value) ? value.length > 0 : !!value && !!value.trim();

/**
 * One of the couple's questions as a step of a question-by-question form.
 * Answers are stored as option ids, so a choice reads back as picked whatever
 * language it was made in. `person` names who the answer is for, when the
 * guest is answering for more than one person.
 */
export function questionStep({
  key,
  question: q,
  answers,
  onChange,
  locale,
  copy,
  person,
  last,
}: {
  key: string;
  question: RsvpQuestion;
  answers: FormAnswers;
  onChange: (next: FormAnswers) => void;
  locale: Locale;
  copy: Dictionary["guestFlow"];
  person?: string;
  /** The form's last question: a single choice must not send by itself. */
  last: boolean;
}): FlowStep {
  const value = answers[q.id];
  const text = typeof value === "string" ? value : "";
  const set = (v: string | string[]) => onChange({ ...answers, [q.id]: v });
  const options = (q.options ?? []).map((o) => ({ id: o.id, label: coupleText(o.label, locale) ?? "" }));

  let body: React.ReactNode = null;
  if (q.kind === "single") {
    body = <FlowChoices options={options} value={typeof value === "string" ? value : null} onChange={set} advance={!last} />;
  } else if (q.kind === "multi") {
    body = (
      <FlowChoices
        multiple
        options={options}
        value={Array.isArray(value) ? value : []}
        onChange={(id) => {
          const list = Array.isArray(value) ? value : [];
          set(list.includes(id) ? list.filter((o) => o !== id) : [...list, id]);
        }}
      />
    );
  } else if (q.kind === "short") {
    body = <FlowText value={text} onChange={set} />;
  } else {
    body = <FlowLongText value={text} onChange={set} />;
  }

  return {
    key,
    title: coupleText(q.title, locale) ?? "",
    description:
      [person, q.kind === "multi" ? copy.chooseMany : null, q.required ? null : copy.optional]
        .filter(Boolean)
        .join(" · ") || undefined,
    body,
    valid: !q.required || answered(value),
  };
}

/** Make the last step before the closing screen the one that sends. */
export function sendFromLastStep(steps: FlowStep[], send: () => Promise<void | false>, sendLabel: string) {
  const endIndex = steps.findIndex((s) => s.kind === "end");
  const last = steps[(endIndex >= 0 ? endIndex : steps.length) - 1];
  if (!last || last.kind === "intro") return;
  const before = last.onNext;
  last.okLabel = sendLabel;
  last.onNext = async () => {
    const result = before ? await before() : undefined;
    // A step that stays put or jumps elsewhere (an added companion) is not
    // the end of the form after all.
    if (result === false || typeof result === "string") return result;
    return send();
  };
}
