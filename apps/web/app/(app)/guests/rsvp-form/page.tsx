"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import type { RsvpQuestion } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import { readRsvpQuestions, saveRsvpQuestions } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, Chip, Button, Loading } from "@/components/ui";

const KIND_LABEL: Record<RsvpQuestion["kind"], { label: string; bg: string; fg: string }> = {
  single: { label: "Single choice", bg: "#EEE7F0", fg: "#7A6690" },
  multi: { label: "Multiple choice", bg: "#E7EFE6", fg: "#5E7A63" },
  short: { label: "Short text", bg: "#FBEEE2", fg: "#B07C48" },
  comment: { label: "Open comment", bg: "#FBEEE2", fg: "#B07C48" },
};

// Bootstrapping template used the first time someone opens the builder.
const STARTER: RsvpQuestion[] = [
  {
    id: "starter-attend",
    kind: "single",
    title: "Will you celebrate with us?",
    required: true,
    options: ["Joyfully accepts", "Regretfully declines"],
  },
  {
    id: "starter-events",
    kind: "multi",
    title: "Which events will you join?",
    required: false,
    options: ["Welcome dinner", "Ceremony", "Reception", "Sunday brunch"],
  },
  {
    id: "starter-meal",
    kind: "single",
    title: "Meal preference",
    required: true,
    options: ["Chicken", "Fish", "Vegetarian", "Kids meal"],
  },
  {
    id: "starter-diet",
    kind: "comment",
    title: "Any dietary needs or allergies?",
    required: false,
  },
];

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;
}

export default function RsvpFormPage() {
  const { wedding, refresh } = useWedding();
  const [questions, setQuestions] = useState<RsvpQuestion[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    const stored = readRsvpQuestions(wedding);
    setQuestions(stored.length > 0 ? stored : STARTER);
    setDirty(stored.length === 0);
  }, [wedding]);

  if (!wedding || questions === null) {
    return (
      <main className="u-main">
        <BackHeader title="Your RSVP form" fallback="/guests" />
        <Loading />
      </main>
    );
  }

  const patch = (id: string, next: Partial<RsvpQuestion>) => {
    setQuestions((qs) =>
      (qs ?? []).map((q) => (q.id === id ? { ...q, ...next } : q)),
    );
    setDirty(true);
  };

  const remove = (id: string) => {
    setQuestions((qs) => (qs ?? []).filter((q) => q.id !== id));
    setDirty(true);
  };

  const move = (id: string, dir: -1 | 1) => {
    setQuestions((qs) => {
      const list = [...(qs ?? [])];
      const i = list.findIndex((q) => q.id === id);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
    setDirty(true);
  };

  const addQuestion = (kind: RsvpQuestion["kind"]) => {
    setQuestions((qs) => [
      ...(qs ?? []),
      {
        id: newId(),
        kind,
        title: "New question",
        required: false,
        options: kind === "single" || kind === "multi" ? ["Option 1", "Option 2"] : undefined,
      },
    ]);
    setDirty(true);
  };

  const save = async () => {
    if (!wedding) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await saveRsvpQuestions(wedding.id, questions);
      await refresh();
      setDirty(false);
      setNote("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title="Your RSVP form"
        subtitle={dirty ? "Unsaved changes" : "Saved"}
        fallback="/guests"
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
          marginBottom: 14,
        }}
      >
        Compose the questions you&apos;d like to ask. Your changes are saved on
        the wedding — the guest-facing RSVP flow currently still accepts the
        default attend/decline reply plus dietary notes; custom questions render
        here for planning and will be available on invite links in a follow-up.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {questions.map((q, idx) => {
          const kind = KIND_LABEL[q.kind];
          return (
            <Card key={q.id} style={{ padding: "15px 16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    background: kind.bg,
                    color: kind.fg,
                    fontWeight: 600,
                    fontSize: 10.5,
                    letterSpacing: "0.04em",
                    padding: "4px 10px",
                    borderRadius: 20,
                  }}
                >
                  {kind.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => move(q.id, -1)}
                    disabled={idx === 0}
                    className="u-link"
                    style={{
                      fontSize: 11,
                      color: idx === 0 ? T.faint : T.muted2,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(q.id, +1)}
                    disabled={idx === questions.length - 1}
                    className="u-link"
                    style={{
                      fontSize: 11,
                      color:
                        idx === questions.length - 1 ? T.faint : T.muted2,
                    }}
                  >
                    ↓
                  </button>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: q.required ? T.accentInk : T.label,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        patch(q.id, { required: e.target.checked })
                      }
                      style={{
                        width: "auto",
                        minHeight: 0,
                        margin: 0,
                      }}
                    />
                    Required
                  </label>
                </div>
              </div>

              <input
                value={q.title}
                onChange={(e) => patch(q.id, { title: e.target.value })}
                placeholder="Question title"
                className="u-serif"
                style={{
                  fontFamily: T.serif,
                  fontWeight: 600,
                  fontSize: 18,
                  color: T.ink,
                  padding: "8px 10px",
                  marginTop: 11,
                  minHeight: 40,
                  borderRadius: 10,
                }}
              />

              {(q.kind === "single" || q.kind === "multi") && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 11,
                  }}
                >
                  {(q.options ?? []).map((opt, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...(q.options ?? [])];
                          next[i] = e.target.value;
                          patch(q.id, { options: next });
                        }}
                        style={{
                          flex: 1,
                          minHeight: 36,
                          padding: "6px 12px",
                          fontSize: 13,
                        }}
                      />
                      <button
                        onClick={() => {
                          const next = (q.options ?? []).filter(
                            (_, j) => j !== i,
                          );
                          patch(q.id, { options: next });
                        }}
                        className="u-link"
                        style={{ color: T.muted2, fontSize: 12 }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      patch(q.id, {
                        options: [
                          ...(q.options ?? []),
                          `Option ${(q.options?.length ?? 0) + 1}`,
                        ],
                      })
                    }
                    className="u-link"
                    style={{
                      alignSelf: "flex-start",
                      color: T.accentInk,
                      fontSize: 12.5,
                    }}
                  >
                    + Add option
                  </button>
                </div>
              )}

              {q.kind === "comment" && (
                <div
                  style={{
                    marginTop: 11,
                    borderRadius: 12,
                    background: "#F7F1EC",
                    border: "1px solid rgba(67,53,58,.08)",
                    padding: "11px 13px",
                    fontSize: 13,
                    color: T.label,
                    fontStyle: "italic",
                  }}
                >
                  Guests type a long-form answer here.
                </div>
              )}

              {q.kind === "short" && (
                <div
                  style={{
                    marginTop: 11,
                    borderRadius: 12,
                    background: "#F7F1EC",
                    border: "1px solid rgba(67,53,58,.08)",
                    padding: "11px 13px",
                    fontSize: 13,
                    color: T.label,
                    fontStyle: "italic",
                  }}
                >
                  Guests type a short answer here.
                </div>
              )}

              <button
                onClick={() => remove(q.id)}
                className="u-link"
                style={{
                  color: "#C0553B",
                  fontSize: 12,
                  marginTop: 10,
                }}
                type="button"
              >
                Remove question
              </button>
            </Card>
          );
        })}

        <Card soft style={{ padding: "14px 16px" }}>
          <div
            style={{ fontWeight: 600, fontSize: 13.5, color: T.accentInk }}
          >
            + Add a question
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
              marginTop: 11,
            }}
          >
            {(
              [
                ["single", "Single choice"],
                ["multi", "Multiple choice"],
                ["short", "Short text"],
                ["comment", "Comment"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => addQuestion(kind)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Chip style={{ fontSize: 11.5, padding: "6px 11px" }}>
                  {label}
                </Chip>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {error && (
        <div className="error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {note && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: T.faint,
            padding: "0 4px",
          }}
        >
          {note}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Button
          style={{ width: "100%", height: 50 }}
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving
            ? "Saving…"
            : dirty
            ? "Save form"
            : "Saved"}
        </Button>
      </div>
    </main>
  );
}
