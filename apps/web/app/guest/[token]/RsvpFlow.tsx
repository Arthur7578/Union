"use client";

import { useState } from "react";
import { Flow, useFlow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices, FlowLongText, FlowText } from "@/components/guest/flow/fields";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { submitGuestRsvp, type CompanionRsvp, type RsvpStatus } from "@/lib/submitRsvp";
import type { DBInvitation } from "./page";

export type Companion = DBInvitation["companions"][number];
type Candidates = DBInvitation["self_merge_candidates"];
type AddKind = "partner" | "child";

/** Everything the RSVP sends, as the hub keeps it between visits to the form. */
export type RsvpReply = {
  status: RsvpStatus;
  dietary: string;
  message: string;
  companions: Record<string, CompanionRsvp>;
};

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
            flow.goTo("message");
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
 * The RSVP, one question at a time: the guest's own answer, then — if they
 * are coming — their diet, each companion's answer, anyone they may add, and
 * a word for the couple. Nothing is saved until the last step sends it all.
 */
export function RsvpFlow({
  token,
  isDemo,
  title,
  subtitle,
  labelAttending,
  labelDeclined,
  guestFirstName,
  coupleNames,
  initial,
  companions,
  canAddPartner,
  canAddKids,
  onCompanionAdded,
  onSaved,
  onClose,
}: {
  token: string;
  isDemo: boolean;
  title: string;
  subtitle: string;
  labelAttending: string;
  labelDeclined: string;
  guestFirstName: string;
  coupleNames: string;
  initial: RsvpReply;
  companions: Companion[];
  canAddPartner: boolean;
  canAddKids: boolean;
  /** A companion is created on the spot, before the RSVP itself is sent. */
  onCompanionAdded: (companion: Companion, kind: AddKind) => void;
  onSaved: (reply: RsvpReply) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const copy = t.rsvpFlow;
  const flowCopy = t.guestFlow;

  const [status, setStatus] = useState<RsvpStatus>(initial.status);
  const [dietary, setDietary] = useState(initial.dietary);
  const [message, setMessage] = useState(initial.message);
  const [replies, setReplies] = useState<Record<string, CompanionRsvp>>(initial.companions);

  // Adding a partner or a child, through rsvp_register_companion (which
  // enforces the permissions and catches duplicates server-side).
  const [addChoice, setAddChoice] = useState<AddKind | "none" | null>(null);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [candidates, setCandidates] = useState<Candidates | null>(null);

  const reply = (id: string): CompanionRsvp => replies[id] ?? { rsvp_status: "pending", dietary_notes: "" };
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
    setReply(id, { rsvp_status: "pending", dietary_notes: "" });
    resetAdd();
    return `companion-${id}`;
  };

  const send = async () => {
    if (status === "pending") return false;
    if (!isDemo) {
      const supabase = getBrowserSupabase();
      await submitGuestRsvp(
        {
          submitPrimary: (args) => supabase.rpc("submit_rsvp", args),
          submitCompanion: (args) => supabase.rpc("submit_companion_rsvp", args),
        },
        {
          token,
          primaryStatus: status,
          primaryDietary: dietary,
          primaryMessage: message,
          companions,
          companionsRsvp: replies,
        },
      );
    }
    onSaved({ status, dietary, message, companions: replies });
  };

  const answerOptions = [
    { id: "attending", label: labelAttending },
    { id: "declined", label: labelDeclined },
  ];
  const coming = status === "attending";

  const steps: FlowStep[] = [
    {
      key: "intro",
      kind: "intro",
      before: <OliveBranch className="tf-ornament" />,
      title,
      description: subtitle,
      body: <p className="tf-meta">{flowCopy.duration(1)}</p>,
    },
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
  ];

  if (coming) {
    steps.push({
      key: "diet",
      title: copy.diet,
      description: copy.dietHint,
      body: <FlowText value={dietary} onChange={setDietary} placeholder={t.rsvp.dietaryPlaceholder} />,
    });

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
      if (r.rsvp_status === "attending") {
        steps.push({
          key: `companion-diet-${c.id}`,
          title: copy.companionDiet(c.first_name),
          description: copy.dietHint,
          body: (
            <FlowText
              value={r.dietary_notes}
              onChange={(v) => setReply(c.id, { dietary_notes: v })}
              placeholder={t.rsvp.dietaryPlaceholder}
            />
          ),
        });
      }
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

  steps.push(
    {
      key: "message",
      title: copy.message(coupleNames),
      description: flowCopy.optional,
      body: <FlowLongText value={message} onChange={setMessage} placeholder={t.rsvp.messagePlaceholder} />,
      okLabel: flowCopy.send,
      onNext: send,
    },
    {
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
    },
  );

  return <Flow label={title} steps={steps} onClose={onClose} />;
}
