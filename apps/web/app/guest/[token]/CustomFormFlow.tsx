"use client";

import { useState } from "react";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import { Flow, type FlowStep } from "@/components/guest/flow/Flow";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { questionStep, sendFromLastStep } from "./questionStep";

/** Someone a form is answered for: the guest, or a relative they're bringing. */
export type Respondent = { id: string; name: string };

/**
 * A couple's own form, one question at a time. A form the couple asks once
 * per person goes through every question for each person the guest answers
 * for — themselves first, then each relative who is coming.
 */
export function CustomFormFlow({
  token,
  isDemo,
  formId,
  heading,
  subtitle,
  questions,
  guestId,
  respondents,
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
  guestId: string;
  /** Just the guest, unless the couple asks this form once per person. */
  respondents: Respondent[];
  /** Answers already on record, keyed by the person they're for. */
  initial: Record<string, FormAnswers>;
  onSaved: (answers: Record<string, FormAnswers>) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.guestFlow;
  const [drafts, setDrafts] = useState<Record<string, FormAnswers>>(initial);

  // One response per person. Sending for everyone, even someone left blank,
  // is deliberate: an all-optional form sent back empty is "nothing to
  // declare" and stops nagging the household.
  const send = async () => {
    if (!isDemo) {
      const supabase = getBrowserSupabase();
      for (const person of respondents) {
        const { error } = await supabase.rpc("submit_form_response", {
          p_token: token,
          p_form_id: formId,
          p_answers: drafts[person.id] ?? {},
          // Omitted for the guest themself, so a form answered once per
          // invitation goes through exactly the call it always did.
          ...(person.id === guestId ? {} : { p_for_guest_id: person.id }),
        });
        if (error) throw error;
      }
    }
    onSaved(Object.fromEntries(respondents.map((p) => [p.id, drafts[p.id] ?? {}])));
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

  const several = respondents.length > 1;
  const total = respondents.length * questions.length;
  respondents.forEach((person, p) => {
    questions.forEach((q, i) => {
      steps.push(
        questionStep({
          key: `${person.id}-${q.id}`,
          question: q,
          answers: drafts[person.id] ?? {},
          onChange: (next) => setDrafts((prev) => ({ ...prev, [person.id]: next })),
          locale,
          copy,
          person: several ? (person.id === guestId ? copy.forYou : copy.forPerson(person.name)) : undefined,
          last: p * questions.length + i === total - 1,
        }),
      );
    });
  });
  if (questions.length) sendFromLastStep(steps, send, copy.send);

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
