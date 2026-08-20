"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import type { Form, FormStatus, RsvpFieldKey, RsvpQuestion } from "@union/shared";
import { askedRsvpFields } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  addForm,
  addReconfirmationForm,
  fetchFormResponseCounts,
  fetchForms,
  fetchGuests,
  formQuestions,
  formStatus,
  guestStats,
  type GuestWithRsvp,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, Button, Loading, StatusPill } from "@/components/ui";

const STATUS_TONE: Record<FormStatus, "green" | "blue" | "sand" | "accent"> = {
  live: "green",
  scheduled: "blue",
  draft: "sand",
  closed: "accent",
};
const STATUS_LABEL: Record<FormStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  draft: "Draft",
  closed: "Closed",
};

/** How each optional RSVP field reads in the "also asks" line — short, since
 *  it's a summary of a decision made inside the form, not the decision. */
const ASK_LABEL: Record<RsvpFieldKey, string> = {
  dietary: "dietary needs",
  companion_dietary: "companions' dietary needs",
  note: "a message",
};

type Template = {
  key: string;
  title: string;
  sub: string;
  questions: RsvpQuestion[];
  /** Whether this template's questions are asked once per person. A meal
   *  choice and an allergy are; a blank form has no way to know yet. */
  perPerson?: boolean;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;
}

/** Template questions ship translated into every language the app supports,
 *  so a form started from a template reads correctly to every guest before
 *  the couple has touched the translator. Anything they reword afterwards is
 *  theirs to translate. */
function option(en: string, fr: string) {
  return { id: newId(), label: { en, fr } };
}

const TEMPLATES: Template[] = [
  {
    key: "details",
    title: "Guest details",
    sub: "Meals, stays, travel & songs — once they know they're coming",
    // Meals and allergies are per plate, so this one starts out asked for
    // every person in the group, children included.
    perPerson: true,
    questions: [
      {
        id: newId(),
        kind: "single",
        title: { en: "Meal preference", fr: "Choix du plat" },
        required: true,
        options: [
          option("Chicken", "Volaille"),
          option("Fish", "Poisson"),
          option("Vegetarian", "Végétarien"),
          option("Kids meal", "Menu enfant"),
        ],
      },
      {
        id: newId(),
        kind: "comment",
        title: {
          en: "Any dietary needs or allergies?",
          fr: "Des allergies ou un régime particulier ?",
        },
        required: false,
      },
      {
        id: newId(),
        kind: "single",
        title: { en: "Where are you staying?", fr: "Où logez-vous ?" },
        required: false,
        options: [
          option("Our room block", "Dans les chambres réservées"),
          option("Booking my own", "Je réserve moi-même"),
          option("Not sure yet", "Je ne sais pas encore"),
        ],
      },
      {
        id: newId(),
        kind: "short",
        title: {
          en: "Song you'd love to hear",
          fr: "Un morceau que vous aimeriez entendre",
        },
        required: false,
      },
    ],
  },
  {
    key: "blank",
    title: "Blank form",
    sub: "Start from scratch",
    questions: [],
  },
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function scheduleLine(form: Form, status: FormStatus): string {
  const opens = formatDate(form.opens_at);
  const closes = formatDate(form.closes_at);
  if (status === "draft") return "Not scheduled yet";
  if (opens && closes) return `Opens ${opens} · closes ${closes}`;
  if (opens) return `Opens ${opens} · no closing date`;
  if (closes) return `Closes ${closes}`;
  return "Always open";
}

export default function FormsHubPage() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [forms, setForms] = useState<Form[] | null>(null);
  const [guests, setGuests] = useState<GuestWithRsvp[] | null>(null);
  // How many guests have replied to each custom form. A form's own card is
  // where the couple looks to know whether it's worth chasing anyone.
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingReconfirmation, setAddingReconfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchForms(wedding.id)
      .then((f) => {
        if (!ok) return;
        setForms(f);
        const custom = f.filter((x) => x.kind === "custom").map((x) => x.id);
        return fetchFormResponseCounts(custom).then((counts) => {
          if (ok) setResponseCounts(counts);
        });
      })
      .catch(() => ok && setForms([]));
    fetchGuests(wedding.id)
      .then((g) => ok && setGuests(g))
      .catch(() => ok && setGuests([]));
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;

  const stats = guests ? guestStats(guests) : null;
  const guestCount = guests?.length ?? 0;
  const liveCount = forms?.filter((f) => formStatus(f) === "live").length ?? 0;
  const hasPrimaryRsvp = forms?.some((f) => f.kind === "rsvp" && f.purpose === "primary") ?? false;
  const reconfirmationForm = forms?.find((f) => f.kind === "rsvp" && f.purpose === "reconfirmation") ?? null;

  const startReconfirmation = async () => {
    if (!wedding) return;
    setAddingReconfirmation(true);
    setError(null);
    try {
      const f = await addReconfirmationForm(wedding.id);
      router.push(`/guests/forms/${f.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the reconfirmation form.");
      setAddingReconfirmation(false);
    }
  };

  const startTemplate = async (tpl: Template) => {
    setCreating(true);
    setError(null);
    try {
      const f = await addForm({
        wedding_id: wedding.id,
        title: tpl.title,
        questions: tpl.questions,
        per_person: tpl.perPerson ?? false,
      });
      router.push(`/guests/forms/${f.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the form.");
      setCreating(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title="Forms"
        subtitle={
          forms
            ? `${forms.length} form${forms.length === 1 ? "" : "s"} · ${liveCount} live now`
            : undefined
        }
        fallback="/guests"
        right={
          <Button
            onClick={() => setShowTemplates(true)}
            style={{ minHeight: 40, fontSize: 14 }}
          >
            + New form
          </Button>
        }
      />

      <div
        style={{
          background: T.accentSoft,
          border: `1px solid ${T.accentBorder}`,
          borderRadius: 14,
          padding: "10px 14px",
          fontSize: 12.5,
          color: T.ink2,
          lineHeight: 1.45,
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        Ask in waves — RSVP now, the fiddly details later, a final headcount
        near the day. Each form opens and closes on its own schedule; open a
        form to change its dates.
      </div>

      {hasPrimaryRsvp && !reconfirmationForm && (
        <Card
          soft
          style={{ padding: "13px 15px", marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>
              Add an RSVP reconfirmation
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 2, lineHeight: 1.4 }}>
              A late "still coming?" nudge, close to the day — same RSVP block,
              its own schedule.
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={startReconfirmation}
            disabled={addingReconfirmation}
            style={{ minHeight: 38, fontSize: 13, whiteSpace: "nowrap" }}
          >
            {addingReconfirmation ? "Adding…" : "+ Add"}
          </Button>
        </Card>
      )}

      {forms === null ? (
        <Loading label="Loading your forms…" />
      ) : forms.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "28px 20px", marginTop: 16 }}>
          <div className="u-serif" style={{ fontSize: 20, color: T.ink }}>
            No forms yet
          </div>
          <div style={{ fontSize: 13.5, color: T.muted, margin: "6px 0 16px" }}>
            Start with a template or a blank form.
          </div>
          <Button onClick={() => setShowTemplates(true)}>Start a new form</Button>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
          {forms.map((f) => {
            const status = formStatus(f);
            const questionCount = formQuestions(f).length;
            const answers = responseCounts[f.id] ?? 0;
            const asked = askedRsvpFields(f.rsvp_fields);
            return (
              <Card
                key={f.id}
                onClick={() => router.push(`/guests/forms/${f.id}`)}
                style={{ padding: "15px 16px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        className="u-serif"
                        style={{ fontWeight: 600, fontSize: 17, color: T.ink }}
                      >
                        {f.title}
                      </span>
                      <StatusPill tone={STATUS_TONE[status]}>
                        {STATUS_LABEL[status]}
                      </StatusPill>
                      {f.purpose === "reconfirmation" && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: T.blueInk,
                            background: T.blueBg,
                            borderRadius: 20,
                            padding: "3px 9px",
                          }}
                        >
                          Reconfirmation
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 3 }}>
                      {scheduleLine(f, status)}
                    </div>
                  </div>
                </div>

                {f.kind === "rsvp" && f.purpose === "primary" ? (
                  <>
                    {stats && (
                      <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                        <MiniStat value={stats.coming} label="Coming" bg={T.greenBg} fg={T.greenDeep} />
                        <MiniStat value={stats.declined} label="Can't" bg={T.roseBg} fg={T.rose} />
                        <MiniStat value={stats.waiting} label="Waiting" bg={T.amberBg} fg={T.amberInk} />
                      </div>
                    )}
                    {/* What this RSVP asks beyond the reply, so a duplicated
                        question is visible from the list rather than only
                        from inside the form. */}
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
                      {asked.length === 0
                        ? "Asks for the reply only"
                        : `Also asks: ${asked.map((k) => ASK_LABEL[k]).join(" · ")}`}
                    </div>
                  </>
                ) : f.kind === "rsvp" && f.purpose === "reconfirmation" ? (
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
                    Same replies as your RSVP, a later nudge
                    {" · "}
                    {asked.length === 0
                      ? "reply only"
                      : `also asks: ${asked.map((k) => ASK_LABEL[k]).join(" · ")}`}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
                    {questionCount} question{questionCount === 1 ? "" : "s"}
                    {f.per_person && " · per person"}
                    {" · "}
                    {answers === 0
                      ? status === "draft" || status === "scheduled"
                        ? "not open yet"
                        : "no answers yet"
                      : guestCount
                        ? `${answers} of ${guestCount} answered`
                        : `${answers} answered`}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showTemplates && (
        <NewFormModal
          busy={creating || addingReconfirmation}
          error={error}
          onCancel={() => {
            if (creating || addingReconfirmation) return;
            setShowTemplates(false);
            setError(null);
          }}
          onPick={startTemplate}
          showReconfirmation={hasPrimaryRsvp && !reconfirmationForm}
          onPickReconfirmation={() => {
            setShowTemplates(false);
            startReconfirmation();
          }}
        />
      )}
    </main>
  );
}

function MiniStat({
  value,
  label,
  bg,
  fg,
}: {
  value: number;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <div style={{ flex: 1, borderRadius: 12, background: bg, padding: "8px 6px", textAlign: "center" }}>
      <div className="u-serif" style={{ fontWeight: 600, fontSize: 17, color: fg, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontWeight: 600, fontSize: 9.5, color: fg, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function NewFormModal({
  busy,
  error,
  onCancel,
  onPick,
  showReconfirmation,
  onPickReconfirmation,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onPick: (tpl: Template) => void;
  showReconfirmation: boolean;
  onPickReconfirmation: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start a new form"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,15,0.45)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 18,
          padding: 20,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 24px 60px rgba(20,15,15,.25)",
          maxHeight: "88vh",
          overflow: "auto",
        }}
      >
        <div className="u-serif" style={{ fontSize: 20, fontWeight: 600, color: T.ink }}>
          Start a new form
        </div>
        <div style={{ fontSize: 12.5, color: T.faint, marginTop: 4 }}>
          Begin from a template — you can tweak everything next.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
          {showReconfirmation && (
            <button
              type="button"
              disabled={busy}
              onClick={onPickReconfirmation}
              style={{
                textAlign: "left",
                border: `1px solid ${T.blueBg}`,
                borderRadius: 14,
                background: T.blueBg,
                padding: "13px 14px",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.blueInk }}>
                RSVP reconfirmation
              </div>
              <div style={{ fontSize: 12, color: T.blueInk, marginTop: 2, opacity: 0.8 }}>
                A late "still coming?" nudge, close to the day — same RSVP block, its own schedule.
              </div>
            </button>
          )}
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              disabled={busy}
              onClick={() => onPick(tpl)}
              style={{
                textAlign: "left",
                border: `1px solid ${T.line3}`,
                borderRadius: 14,
                background: "#fff",
                padding: "13px 14px",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
                {tpl.title}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                {tpl.sub}
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="error" style={{ marginTop: 14, marginBottom: 0 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ width: "100%" }}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
