"use client";

import { useState } from "react";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import { Flow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices, FlowLongText, FlowText } from "@/components/guest/flow/fields";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useLocale } from "@/lib/i18n/client";
import { coupleText } from "@/lib/i18n/text";
import { getBrowserSupabase } from "@/lib/supabaseClient";

const answered = (value: FormAnswers[string] | undefined) =>
  Array.isArray(value) ? value.length > 0 : !!value && !!value.trim();

/**
 * A couple's own form, one question at a time. Answers are stored as option
 * ids, so a choice reads back as picked whatever language it was made in.
 */
export function CustomFormFlow({
  token,
  isDemo,
  formId,
  heading,
  subtitle,
  questions,
  initial,
  onSaved,
  onClose,
}: {
  token: string;
  isDemo: boolean;
  formId: string;
  heading: string;
  /** The couple's line of context, if they wrote one. */
  subtitle?: string;
  questions: RsvpQuestion[];
  initial: FormAnswers;
  onSaved: (answers: FormAnswers) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.guestFlow;
  const [draft, setDraft] = useState<FormAnswers>(initial);

  const send = async () => {
    if (!isDemo) {
      const { error } = await getBrowserSupabase().rpc("submit_form_response", {
        p_token: token,
        p_form_id: formId,
        p_answers: draft,
      });
      if (error) throw error;
    }
    onSaved(draft);
  };

  const steps: FlowStep[] = [
    {
      key: "intro",
      kind: "intro",
      before: <OliveBranch className="tf-ornament" />,
      title: heading,
      description: subtitle,
      body: <p className="tf-meta">{t.guestHub.questions(questions.length)}</p>,
      // A form with no questions yet still records that the guest opened it.
      okLabel: questions.length ? undefined : copy.send,
      onNext: questions.length ? undefined : send,
    },
  ];

  questions.forEach((q, i) => {
    const value = draft[q.id];
    const text = typeof value === "string" ? value : "";
    const last = i === questions.length - 1;
    const set = (v: string | string[]) => setDraft((prev) => ({ ...prev, [q.id]: v }));
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
            const list = Array.isArray(draft[q.id]) ? (draft[q.id] as string[]) : [];
            set(list.includes(id) ? list.filter((o) => o !== id) : [...list, id]);
          }}
        />
      );
    } else if (q.kind === "short") {
      body = <FlowText value={text} onChange={set} />;
    } else {
      body = <FlowLongText value={text} onChange={set} />;
    }

    steps.push({
      key: q.id,
      title: coupleText(q.title, locale) ?? "",
      description: [q.kind === "multi" ? copy.chooseMany : null, q.required ? null : copy.optional]
        .filter(Boolean)
        .join(" · ") || undefined,
      body,
      valid: !q.required || answered(value),
      okLabel: last ? copy.send : undefined,
      onNext: last ? send : undefined,
    });
  });

  steps.push({
    key: "end",
    kind: "end",
    before: <OliveBranch className="tf-ornament" />,
    title: t.formFlow.thanks,
    description: t.formFlow.thanksBody,
    okLabel: copy.back,
    onNext: () => {
      onClose();
      return false;
    },
  });

  return <Flow label={heading} steps={steps} onClose={onClose} />;
}
