"use client";

import { useState } from "react";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import { Flow, useFlow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices, FlowText } from "@/components/guest/flow/fields";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { suggestEmailFix } from "@/lib/emailSuggest";
import { RSVP_DIETARY_QUESTION_ID } from "@/lib/rsvpQuestions";
import { submitGuestRsvp, type CompanionRsvp, type RsvpStatus } from "@/lib/submitRsvp";
import type { DBInvitation } from "./page";
import { questionStep, sendFromLastStep } from "./questionStep";
import type { ReplyEmail } from "./ReplyEmailField";

export type Companion = DBInvitation["companions"][number];
type Candidates = DBInvitation["self_merge_candidates"];
type AddKind = "partner" | "child";

/** Who is coming, as the hub keeps it between visits to the form. The answers
 *  to the RSVP form's questions are kept per form, beside it. */
export type RsvpReply = {
  status: RsvpStatus;
  companions: Record<string, CompanionRsvp>;
};

/** Answers to an RSVP form's questions, keyed by the person they're for. */
export type RsvpAnswers = Record<string, FormAnswers>;

/** "Someone like this is already on the list": add anyway, or don't. */
function Lookalikes({
  candidates,
  onAddAnyway,
  onCancel,
}: {
  candidates: Candidates;
  /** Creates the companion regardless; answers the step to go to. */
  onAddAnyway: () => Promise<string | false>;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const flow = useFlow();
  const copy = t.rsvpFlow;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="tf-candidates">
      <p>{copy.lookalike}</p>
      <ul>
        {candidates.map((c) => (
          <li key={c.id}>
            {[c.first_name, c.last_name].filter(Boolean).join(" ")}
            {c.added_by_first_name ? ` (${copy.addedBy(c.added_by_first_name)})` : ""}
          </li>
        ))}
      </ul>
      <div className="row">
        <button
          type="button"
          className="tf-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              const target = await onAddAnyway();
              if (target) flow.goTo(target);
            } catch (e) {
              console.error("Failed to add companion:", e);
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t.common.saving : copy.addAnyway}
        </button>
        <button
          type="button"
          className="tf-ghost"
          disabled={busy}
          onClick={() => {
            onCancel();
            flow.goTo("add");
          }}
        >
          {copy.cancel}
        </button>
      </div>
      {failed ? (
        <p className="tf-error" role="alert">
          {t.guestFlow.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The RSVP, one question at a time: the guest's own answer and the couple's
 * questions for them, then — if they are coming — each companion's answer and
 * the questions for each one who comes, and anyone they may add. Nothing is
 * saved until the last step sends it all, in one transaction.
 */
export function RsvpFlow({
  token,
  isDemo,
  formId,
  questions,
  guestId,
  title,
  subtitle,
  labelAttending,
  labelDeclined,
  guestFirstName,
  coupleNames,
  replyEmail,
  skipIntro = false,
  initial,
  initialAnswers,
  companions,
  canAddPartner,
  canAddKids,
  onCompanionAdded,
  onSaved,
  onClose,
}: {
  token: string;
  isDemo: boolean;
  /** The RSVP form being answered; null when it couldn't be loaded. */
  formId: string | null;
  /** That form's questions, which the couple edits in the form builder. */
  questions: RsvpQuestion[];
  guestId: string;
  title: string;
  subtitle: string;
  labelAttending: string;
  labelDeclined: string;
  guestFirstName: string;
  coupleNames: string;
  /** The guest's email, asked here when the couple has none (see ReplyEmailField). */
  replyEmail?: ReplyEmail;
  /** Start at the first question (opened from the faire-part's "respond"). */
  skipIntro?: boolean;
  initial: RsvpReply;
  initialAnswers: RsvpAnswers;
  companions: Companion[];
  canAddPartner: boolean;
  canAddKids: boolean;
  /** A companion is created on the spot, before the RSVP itself is sent. */
  onCompanionAdded: (companion: Companion, kind: AddKind) => void;
  onSaved: (reply: RsvpReply, answers: RsvpAnswers) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.rsvpFlow;
  const flowCopy = t.guestFlow;

  const [status, setStatus] = useState<RsvpStatus>(initial.status);
  const [replies, setReplies] = useState<Record<string, CompanionRsvp>>(initial.companions);
  const [answers, setAnswers] = useState<RsvpAnswers>(initialAnswers);

  // Adding a partner or a child, through rsvp_register_companion (which
  // enforces the permissions and catches duplicates server-side).
  const [addChoice, setAddChoice] = useState<AddKind | "none" | null>(null);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [candidates, setCandidates] = useState<Candidates | null>(null);

  const reply = (id: string): CompanionRsvp => replies[id] ?? { rsvp_status: "pending" };
  const setReply = (id: string, patch: Partial<CompanionRsvp>) =>
    setReplies((prev) => ({ ...prev, [id]: { ...reply(id), ...patch } }));

  const resetAdd = () => {
    setAddChoice(null);
    setAddFirst("");
    setAddLast("");
    setCandidates(null);
  };

  /** Creates the companion; answers the step to jump to, or false to stay. */
  const addCompanion = async (resolve: "auto" | "force_create"): Promise<string | false> => {
    if (addChoice !== "partner" && addChoice !== "child") return false;
    const kind = addChoice;
    const first = addFirst.trim();
    const last = addLast.trim();
    let id: string;
    if (isDemo) {
      id = `demo-${kind}-${Date.now()}`;
    } else {
      const { data, error } = await getBrowserSupabase().rpc("rsvp_register_companion", {
        p_token: token,
        p_kind: kind,
        p_first_name: first,
        p_last_name: last || undefined,
        p_resolve: resolve,
      });
      if (error) throw error;
      const result = data as { status: "candidates" | "created"; candidates?: Candidates; guest_id?: string };
      if (result.status === "candidates") {
        setCandidates(result.candidates ?? []);
        return false;
      }
      id = result.guest_id as string;
    }
    onCompanionAdded(
      {
        id,
        first_name: first,
        last_name: last || null,
        age_years: null,
        relationship: kind === "partner" ? "partner_of" : "parent_of",
        rsvp_status: "pending",
        dietary_notes: null,
      },
      kind,
    );
    setReply(id, { rsvp_status: "pending" });
    resetAdd();
    return `companion-${id}`;
  };

  const coming = status === "attending";
  // Everyone the couple's questions are asked of, and which questions: all of
  // them for each person who is coming; for a guest who declines, everything
  // but the dietary question, so they can still leave the couple a word.
  const respondents: Array<{ id: string; name: string; questions: RsvpQuestion[] }> =
    status === "pending"
      ? []
      : [
          {
            id: guestId,
            name: guestFirstName,
            questions: coming ? questions : questions.filter((q) => q.id !== RSVP_DIETARY_QUESTION_ID),
          },
          ...(coming
            ? companions
                .filter((c) => reply(c.id).rsvp_status === "attending")
                .map((c) => ({ id: c.id, name: c.first_name, questions }))
            : []),
        ];

  const send = async (): Promise<void | false> => {
    if (status === "pending") return false;
    const asked = respondents.filter((r) => r.questions.length > 0);
    if (!isDemo) {
      const supabase = getBrowserSupabase();
      await submitGuestRsvp(
        { submitResponse: (args) => supabase.rpc("submit_rsvp_response", args) },
        {
          token,
          formId,
          primaryStatus: status,
          companions,
          companionsRsvp: replies,
          responses: formId ? asked.map((r) => ({ guestId: r.id, answers: answers[r.id] ?? {} })) : [],
        },
      );
    }
    onSaved({ status, companions: replies }, answers);
  };

  const answerOptions = [
    { id: "attending", label: labelAttending },
    { id: "declined", label: labelDeclined },
  ];
  // Say whose answer each question is for whenever the guest may answer for
  // others too — decided up front, so their own questions are labelled even
  // before a companion has said they're coming.
  const several = coming && companions.length > 0 && questions.length > 0;
  // A question step for one person; `last` is settled once every step is known.
  const questionsFor = (person: (typeof respondents)[number]) =>
    person.questions.map((q) => (last: boolean) =>
      questionStep({
        key: `q-${person.id}-${q.id}`,
        question: q,
        answers: answers[person.id] ?? {},
        onChange: (next) => setAnswers((prev) => ({ ...prev, [person.id]: next })),
        locale,
        copy: flowCopy,
        person: several ? (person.id === guestId ? flowCopy.forYou : flowCopy.forPerson(person.name)) : undefined,
        last,
      }),
    );

  // Asked first, before the answer itself, when the couple has no email for
  // this guest (see ReplyEmailField); a group-link arrival must give one.
  let emailStep: FlowStep | null = null;
  if (replyEmail?.show) {
    const suggestion = suggestEmailFix(replyEmail.email);
    emailStep = {
      key: "email",
      title: t.replyEmail.label,
      description: replyEmail.required ? t.replyEmail.hintRequired(coupleNames) : t.replyEmail.hintOptional(coupleNames),
      body: (
        <>
          <FlowText
            type="email"
            value={replyEmail.email}
            onChange={replyEmail.setEmail}
            placeholder={t.replyEmail.placeholder}
            label={t.replyEmail.label}
            autoComplete="email"
          />
          {suggestion ? (
            <div className="tf-links">
              <button type="button" className="tf-link" onClick={() => replyEmail.setEmail(suggestion)}>
                {t.replyEmail.suggestion(suggestion)}
              </button>
            </div>
          ) : null}
          {replyEmail.error ? (
            <p className="tf-error" role="alert">
              {replyEmail.error}
            </p>
          ) : null}
        </>
      ),
      // Saved as given (unconfirmed) before the reply itself is sent; a
      // required address that's missing or malformed keeps the guest here.
      // Once saved this step leaves the list, so it names what comes next.
      onNext: async () => ((await replyEmail.save()) ? "attend" : false),
    };
  }

  const steps: Array<FlowStep | ((last: boolean) => FlowStep)> = [];
  // From the faire-part's "respond", the faire-part was the introduction.
  if (!skipIntro) {
    steps.push({
      key: "intro",
      kind: "intro",
      before: <OliveBranch className="tf-ornament" />,
      title,
      description: subtitle,
      body: <p className="tf-meta">{flowCopy.duration(1)}</p>,
    });
  }
  if (emailStep) steps.push(emailStep);
  steps.push(
    {
      key: "attend",
      title: copy.attend(guestFirstName),
      body: (
        <FlowChoices
          options={answerOptions}
          value={status === "pending" ? null : status}
          onChange={(id) => setStatus(id as RsvpStatus)}
        />
      ),
      valid: status !== "pending",
      hideOk: status === "pending",
    },
  );

  const self = respondents.find((r) => r.id === guestId);
  if (self) steps.push(...questionsFor(self));

  if (coming) {
    for (const c of companions) {
      const r = reply(c.id);
      steps.push({
        key: `companion-${c.id}`,
        title: copy.companion(c.first_name),
        description: flowCopy.optional,
        body: (
          <FlowChoices
            options={answerOptions}
            value={r.rsvp_status === "pending" ? null : r.rsvp_status}
            onChange={(id) => setReply(c.id, { rsvp_status: id as RsvpStatus })}
          />
        ),
      });
      const person = respondents.find((p) => p.id === c.id);
      if (person) steps.push(...questionsFor(person));
    }

    if (canAddPartner || canAddKids) {
      steps.push({
        key: "add",
        title: copy.addSomeone,
        body: (
          <FlowChoices
            options={[
              ...(canAddPartner ? [{ id: "partner", label: copy.addPartner }] : []),
              ...(canAddKids ? [{ id: "child", label: copy.addChild }] : []),
              { id: "none", label: copy.addNobody },
            ]}
            value={addChoice}
            onChange={(id) => {
              setCandidates(null);
              setAddChoice(id as AddKind | "none");
            }}
          />
        ),
        valid: addChoice !== null,
        hideOk: addChoice === null,
      });
      if (addChoice === "partner" || addChoice === "child") {
        steps.push({
          key: "add-name",
          title: addChoice === "partner" ? copy.partnerName : copy.childName,
          body: (
            <>
              <div className="tf-pair">
                <FlowText
                  value={addFirst}
                  onChange={(v) => {
                    setAddFirst(v);
                    setCandidates(null);
                  }}
                  placeholder={copy.firstName}
                  label={copy.firstName}
                  autoComplete="given-name"
                />
                <FlowText
                  value={addLast}
                  onChange={(v) => {
                    setAddLast(v);
                    setCandidates(null);
                  }}
                  placeholder={copy.lastName}
                  label={copy.lastName}
                  autoFocus={false}
                  autoComplete="family-name"
                />
              </div>
              {candidates ? (
                <Lookalikes
                  candidates={candidates}
                  onAddAnyway={() => addCompanion("force_create")}
                  onCancel={() => {
                    resetAdd();
                    setAddChoice("none");
                  }}
                />
              ) : null}
            </>
          ),
          valid: addFirst.trim() !== "",
          invalidMessage: copy.firstNameRequired,
          hideOk: !!candidates,
          onNext: () => addCompanion("auto"),
        });
      }
    }
  }

  const resolved = steps.map((step, i) => (typeof step === "function" ? step(i === steps.length - 1) : step));
  // Whichever step comes last — a question, a companion's answer, "anyone
  // else?", or the guest's own answer — sends the reply.
  sendFromLastStep(resolved, send, flowCopy.send);
  resolved.push({
    key: "end",
    kind: "end",
    before: <OliveBranch className="tf-ornament" />,
    title: coming ? copy.thanksComing(guestFirstName) : copy.thanksNotComing(guestFirstName),
    description: coming ? copy.comingBody(coupleNames) : copy.notComingBody(coupleNames),
    okLabel: flowCopy.back,
    onNext: () => {
      onClose();
      return false;
    },
  });

  return <Flow label={title} steps={resolved} onClose={onClose} />;
}
