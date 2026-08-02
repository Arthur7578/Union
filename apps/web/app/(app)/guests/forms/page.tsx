"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import type { Form, FormStatus, RsvpQuestion } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  addForm,
  addReconfirmationForm,
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

type Template = {
  key: string;
  title: string;
  sub: string;
  questions: RsvpQuestion[];
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;
}

const TEMPLATES: Template[] = [
  {
    key: "details",
    title: "Guest details",
    sub: "Meals, stays, travel & songs — once they know they're coming",
    questions: [
      { id: newId(), kind: "single", title: "Meal preference", required: true, options: ["Chicken", "Fish", "Vegetarian", "Kids meal"] },
      { id: newId(), kind: "comment", title: "Any dietary needs or allergies?", required: false },
      { id: newId(), kind: "single", title: "Where are you staying?", required: false, options: ["Our room block", "Booking my own", "Not sure yet"] },
      { id: newId(), kind: "short", title: "Song you'd love to hear", required: false },
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingReconfirmation, setAddingReconfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchForms(wedding.id)
      .then((f) => ok && setForms(f))
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

                {f.kind === "rsvp" && f.purpose === "primary" && stats ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                    <MiniStat value={stats.coming} label="Coming" bg={T.greenBg} fg={T.greenDeep} />
                    <MiniStat value={stats.declined} label="Can't" bg={T.roseBg} fg={T.rose} />
                    <MiniStat value={stats.waiting} label="Waiting" bg={T.amberBg} fg={T.amberInk} />
                  </div>
                ) : f.kind === "rsvp" && f.purpose === "reconfirmation" ? (
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
                    Reuses the RSVP block — same replies, a later nudge.
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
                    {questionCount} question{questionCount === 1 ? "" : "s"}
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
