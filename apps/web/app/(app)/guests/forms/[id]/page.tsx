"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import type { Form, RsvpBlockCopy, RsvpQuestion } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  deleteForm,
  fetchForm,
  formQuestions,
  formStatus,
  rsvpCopy,
  updateForm,
  updateWedding,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, Chip, Button, Loading, Switch, StatusPill } from "@/components/ui";

const KIND_LABEL: Record<RsvpQuestion["kind"], { label: string; bg: string; fg: string }> = {
  single: { label: "Single choice", bg: "#EEE7F0", fg: "#7A6690" },
  multi: { label: "Multiple choice", bg: "#E7EFE6", fg: "#5E7A63" },
  short: { label: "Short text", bg: "#FBEEE2", fg: "#B07C48" },
  comment: { label: "Open comment", bg: "#FBEEE2", fg: "#B07C48" },
};

/** System defaults for the RSVP block's guest-facing copy — what guests see
 *  when the couple hasn't overridden a slot. Kept here (not in GuestPortal)
 *  so the admin preview and the real guest render can never drift apart. */
const RSVP_COPY_DEFAULTS: Record<"primary" | "reconfirmation", Required<Omit<RsvpBlockCopy, "label_attending" | "label_declined">> & Pick<RsvpBlockCopy, "label_attending" | "label_declined">> = {
  primary: {
    title: "Attendance RSVP",
    subtitle: "Let us know if you and your companions will join us.",
    label_attending: "Attending",
    label_declined: "Declined",
  },
  reconfirmation: {
    title: "Still coming?",
    subtitle: "A quick check-in before the big day — confirm or update your RSVP.",
    label_attending: "Attending",
    label_declined: "Declined",
  },
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

/** Section wrapper — a tinted container + kicker is how organiser-only
 *  settings, guest-facing questions, and access/rights stay visually
 *  distinct as you scroll, instead of blurring into one long form. */
function SectionBlock({
  kicker,
  hint,
  tone,
  children,
}: {
  kicker: string;
  hint?: string;
  tone: { bg: string; border: string; fg: string };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 20,
        padding: 16,
        marginTop: 18,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tone.fg,
        }}
      >
        {kicker}
      </div>
      {hint && (
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
      <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        {children}
      </div>
    </div>
  );
}

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { wedding, refresh } = useWedding();
  const [form, setForm] = useState<Form | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [questions, setQuestions] = useState<RsvpQuestion[]>([]);
  const [rsvpCopyState, setRsvpCopyState] = useState<RsvpBlockCopy>({});
  const [title, setTitle] = useState("");
  const [published, setPublished] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let ok = true;
    fetchForm(params.id)
      .then((f) => {
        if (!ok) return;
        if (!f) {
          setNotFound(true);
          return;
        }
        setForm(f);
        setQuestions(formQuestions(f));
        setRsvpCopyState(rsvpCopy(f));
        setTitle(f.title);
        setPublished(f.published);
        setOpensAt(toDateInput(f.opens_at));
        setClosesAt(toDateInput(f.closes_at));
      })
      .catch(() => ok && setNotFound(true));
    return () => {
      ok = false;
    };
  }, [params.id]);

  if (notFound) {
    return (
      <main className="u-main">
        <BackHeader title="Form" fallback="/guests/forms" />
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 14, color: T.muted }}>
            Couldn&apos;t find that form.
          </div>
        </Card>
      </main>
    );
  }

  if (!wedding || !form) {
    return (
      <main className="u-main">
        <BackHeader title="Form" fallback="/guests/forms" />
        <Loading />
      </main>
    );
  }

  const markDirty = () => setDirty(true);

  const patchQuestion = (id: string, next: Partial<RsvpQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...next } : q)));
    markDirty();
  };

  const changeKind = (id: string, kind: RsvpQuestion["kind"]) => {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== id) return q;
        const needsOptions = kind === "single" || kind === "multi";
        return {
          ...q,
          kind,
          options: needsOptions ? q.options ?? ["Option 1", "Option 2"] : q.options,
        };
      }),
    );
    markDirty();
  };

  const removeQuestion = (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    markDirty();
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setQuestions((qs) => {
      const list = [...qs];
      const i = list.findIndex((q) => q.id === id);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
    markDirty();
  };

  const addQuestion = (kind: RsvpQuestion["kind"]) => {
    setQuestions((qs) => [
      ...qs,
      {
        id: newId(),
        kind,
        title: "New question",
        required: false,
        options: kind === "single" || kind === "multi" ? ["Option 1", "Option 2"] : undefined,
      },
    ]);
    markDirty();
  };

  const status = formStatus({ ...form, published, opens_at: fromDateInput(opensAt), closes_at: fromDateInput(closesAt) });

  const save = async () => {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const updated = await updateForm(form.id, {
        title: title.trim() || form.title,
        published,
        opens_at: fromDateInput(opensAt),
        closes_at: fromDateInput(closesAt),
        questions,
        ...(form.kind === "rsvp" ? { rsvp_copy: rsvpCopyState } : {}),
      });
      setForm(updated);
      setDirty(false);
      setNote("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${form.title}"? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteForm(form);
      router.push("/guests/forms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setDeleting(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={form.title}
        subtitle={dirty ? "Unsaved changes" : "Saved"}
        fallback="/guests/forms"
        right={<StatusPill tone={status === "live" ? "green" : status === "scheduled" ? "blue" : status === "closed" ? "accent" : "sand"}>
          {status === "live" ? "Live" : status === "scheduled" ? "Scheduled" : status === "closed" ? "Closed" : "Draft"}
        </StatusPill>}
      />

      {/* ---------------- Organiser-only settings ---------------- */}
      <SectionBlock
        kicker={form.kind === "custom" ? "Form name · guests see this as the title" : "Organiser only · not shown to guests"}
        hint={
          form.kind === "custom"
            ? "Unlike the RSVP block, custom forms have no separate guest-facing headline — this name and schedule are what guests see."
            : "The name and schedule are for you — guests never see them."
        }
        tone={{ bg: T.sandBg, border: "rgba(169,154,144,.35)", fg: T.sand }}
      >
        <Card style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 5 }}>
            Form name
          </div>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="e.g. Guest details"
            className="u-serif"
            style={{
              fontFamily: T.serif,
              fontWeight: 600,
              fontSize: 18,
              color: T.ink,
              padding: "6px 4px",
              minHeight: 36,
            }}
          />
        </Card>

        <Card style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 9 }}>
            When it&apos;s open
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.muted2 }}>Opens</label>
              <input
                type="date"
                value={opensAt}
                onChange={(e) => {
                  setOpensAt(e.target.value);
                  markDirty();
                }}
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.muted2 }}>Closes</label>
              <input
                type="date"
                value={closesAt}
                onChange={(e) => {
                  setClosesAt(e.target.value);
                  markDirty();
                }}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 8 }}>
            Leave either blank for no limit. Come back here to shift the
            dates — there&apos;s no separate timeline to manage.
          </div>
        </Card>
      </SectionBlock>

      {/* ---------------- RSVP block wording (guarded) ---------------- */}
      {form.kind === "rsvp" && (
        <RsvpWordingEditor
          purpose={form.purpose === "reconfirmation" ? "reconfirmation" : "primary"}
          copy={rsvpCopyState}
          onChange={(next) => {
            setRsvpCopyState(next);
            markDirty();
          }}
        />
      )}

      {!(form.kind === "rsvp" && form.purpose === "reconfirmation") && (
        <>
      {/* ---------------- Guest-facing questions ---------------- */}
      <SectionBlock
        kicker="What guests see"
        hint="Every question is yours to shape — title, type, required or not, and its choices."
        tone={{ bg: T.accentSoft, border: T.accentBorder, fg: T.accentInk }}
      >
        {questions.map((q, idx) => {
          const kind = KIND_LABEL[q.kind];
          return (
            <Card key={q.id} style={{ padding: "15px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <select
                  value={q.kind}
                  onChange={(e) => changeKind(q.id, e.target.value as RsvpQuestion["kind"])}
                  style={{
                    background: kind.bg,
                    color: kind.fg,
                    fontWeight: 600,
                    fontSize: 11.5,
                    padding: "5px 10px",
                    borderRadius: 20,
                    border: "none",
                    minHeight: 0,
                  }}
                >
                  <option value="single">Single choice</option>
                  <option value="multi">Multiple choice</option>
                  <option value="short">Short text</option>
                  <option value="comment">Open comment</option>
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => moveQuestion(q.id, -1)}
                    disabled={idx === 0}
                    className="u-link"
                    style={{ fontSize: 11, color: idx === 0 ? T.faint : T.muted2 }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveQuestion(q.id, +1)}
                    disabled={idx === questions.length - 1}
                    className="u-link"
                    style={{ fontSize: 11, color: idx === questions.length - 1 ? T.faint : T.muted2 }}
                    type="button"
                  >
                    ↓
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: q.required ? T.accentInk : T.label, margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                      style={{ width: "auto", minHeight: 0, margin: 0 }}
                    />
                    Required
                  </label>
                </div>
              </div>

              <input
                value={q.title}
                onChange={(e) => patchQuestion(q.id, { title: e.target.value })}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
                  {(q.options ?? []).map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...(q.options ?? [])];
                          next[i] = e.target.value;
                          patchQuestion(q.id, { options: next });
                        }}
                        style={{ flex: 1, minHeight: 36, padding: "6px 12px", fontSize: 13 }}
                      />
                      <button
                        onClick={() => {
                          const next = (q.options ?? []).filter((_, j) => j !== i);
                          patchQuestion(q.id, { options: next });
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
                      patchQuestion(q.id, {
                        options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`],
                      })
                    }
                    className="u-link"
                    style={{ alignSelf: "flex-start", color: T.accentInk, fontSize: 12.5 }}
                  >
                    + Add option
                  </button>
                </div>
              )}

              {(q.kind === "comment" || q.kind === "short") && (
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
                  Guests type a {q.kind === "comment" ? "long-form" : "short"} answer here.
                </div>
              )}

              <button
                onClick={() => removeQuestion(q.id)}
                className="u-link"
                style={{ color: "#C0553B", fontSize: 12, marginTop: 10 }}
                type="button"
              >
                Remove question
              </button>
            </Card>
          );
        })}

        <Card soft style={{ padding: "14px 16px" }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: T.accentInk }}>
            + Add a question
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
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
                style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
              >
                <Chip style={{ fontSize: 11.5, padding: "6px 11px" }}>{label}</Chip>
              </button>
            ))}
          </div>
        </Card>

        {form.kind === "rsvp" && (
          <div style={{ fontSize: 12, color: T.muted2, lineHeight: 1.5, padding: "0 2px" }}>
            These are extra planning notes for you — the attend/decline reply,
            dietary notes and its wording are handled by the RSVP block above,
            wired straight to the real guest flow.
          </div>
        )}
      </SectionBlock>
      </>
      )}

      {/* ---------------- Access & rights ---------------- */}
      <SectionBlock
        kicker="Access & rights"
        hint="Who can reach this form, and what they're allowed to do once they're in it."
        tone={{ bg: T.blueBg, border: "rgba(92,100,138,.28)", fg: T.blueInk }}
      >
        <Card style={{ padding: "13px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Switch
              on={published}
              onChange={() => {
                setPublished((v) => !v);
                markDirty();
              }}
              label="Published"
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>
                {published ? "Published" : "Draft — hidden from guests"}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                Drafts never reach guests, whatever the schedule says.
              </div>
            </div>
          </div>
        </Card>

        {form.kind === "rsvp" && form.purpose === "primary" && wedding && (
          <ExtraGuestsRights wedding={wedding} refresh={refresh} />
        )}
      </SectionBlock>

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}
      {note && (
        <div style={{ marginTop: 12, fontSize: 12, color: T.faint, padding: "0 4px" }}>
          {note}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Button style={{ width: "100%", height: 50 }} onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      {!(form.kind === "rsvp" && form.purpose === "primary") && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            onClick={remove}
            disabled={deleting}
            className="u-link"
            style={{ color: "#C0553B", fontSize: 13 }}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete this form"}
          </button>
        </div>
      )}
    </main>
  );
}

/** The "extra guests" rights (add a partner / add children from the RSVP)
 *  only take effect when they're turned on for the whole wedding here AND
 *  not overridden per guest — this block makes that dependency explicit
 *  instead of letting the couple assume a form-level toggle is enough. */
function ExtraGuestsRights({
  wedding,
  refresh,
}: {
  wedding: NonNullable<ReturnType<typeof useWedding>["wedding"]>;
  refresh: () => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = async (p: Partial<{
    allow_guests_add_partner: boolean;
    allow_guests_add_children: boolean;
  }>) => {
    setSaving(true);
    setErr(null);
    try {
      await updateWedding(wedding.id, p);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ padding: "13px 15px" }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>
        Extra guests
      </div>
      <div style={{ fontSize: 12, color: T.faint, marginTop: 3, lineHeight: 1.45 }}>
        Letting a guest add a partner or children from their RSVP depends on{" "}
        <b style={{ color: T.ink2 }}>both</b> of these — the wedding-wide
        default below, and that guest&apos;s own rights not overriding it.
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={wedding.allow_guests_add_partner}
          onChange={(e) => patch({ allow_guests_add_partner: e.target.checked })}
          disabled={saving}
        />
        <span style={{ fontSize: 13 }}>Guests may add a partner by default</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={wedding.allow_guests_add_children}
          onChange={(e) => patch({ allow_guests_add_children: e.target.checked })}
          disabled={saving}
        />
        <span style={{ fontSize: 13 }}>Guests may add children by default</span>
      </label>

      <div style={{ marginTop: 10 }}>
        <Link href="/guests/permissions" className="u-link" style={{ fontSize: 12.5, color: T.accentInk }}>
          Manage per-guest overrides →
        </Link>
      </div>

      {err && <div style={{ color: "#C0553B", fontSize: 12, marginTop: 8 }}>{err}</div>}
    </Card>
  );
}

/** One captioned, anchored input for a single RSVP-copy slot. The caption and
 *  the (optional) fixed color/icon dot never change with what the couple
 *  types — that's the point: there's nothing here to reorder or swap, so a
 *  reworded label can never end up wired to the wrong meaning. */
function CopyField({
  caption,
  dot,
  value,
  placeholder,
  onChange,
}: {
  caption: string;
  dot?: { bg: string; fg: string; symbol: string };
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card style={{ padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        {dot && (
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: dot.bg,
              color: dot.fg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {dot.symbol}
          </span>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>{caption}</div>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight: 38, padding: "8px 10px", fontSize: 14 }}
      />
    </Card>
  );
}

/** The RSVP block's guest-facing wording — deliberately not a free-form list
 *  of options. Every slot is its own captioned, color-anchored field bound to
 *  one fixed meaning (attending / declined / framing copy), so rewording it
 *  can change tone without ever being able to silently invert which button
 *  means "coming" and which means "not coming". A live preview, rendered
 *  with the exact same colors and icons guests will see, makes any confusing
 *  wording obvious immediately rather than after it's live. */
function RsvpWordingEditor({
  purpose,
  copy,
  onChange,
}: {
  purpose: "primary" | "reconfirmation";
  copy: RsvpBlockCopy;
  onChange: (next: RsvpBlockCopy) => void;
}) {
  const defaults = RSVP_COPY_DEFAULTS[purpose];
  const title = copy.title ?? "";
  const subtitle = copy.subtitle ?? "";
  const attending = copy.label_attending ?? "";
  const declined = copy.label_declined ?? "";

  return (
    <SectionBlock
      kicker={purpose === "primary" ? "RSVP block · what guests see" : "Reconfirmation block · what guests see"}
      hint={
        purpose === "primary"
          ? "Reword the headline and the two reply buttons — the reply itself (and everything it triggers) stays wired to the real RSVP."
          : "Reword the framing for this late check-in. It reuses the same Attending / Declined buttons as the main RSVP."
      }
      tone={{ bg: T.accentSoft, border: T.accentBorder, fg: T.accentInk }}
    >
      <CopyField
        caption="Headline guests see"
        value={title}
        placeholder={defaults.title}
        onChange={(v) => onChange({ ...copy, title: v })}
      />
      <CopyField
        caption="Supporting line"
        value={subtitle}
        placeholder={defaults.subtitle}
        onChange={(v) => onChange({ ...copy, subtitle: v })}
      />

      {purpose === "primary" && (
        <>
          <CopyField
            caption="Label on the button meaning “coming” — locked to that meaning, only this text is yours"
            dot={{ bg: T.greenBg, fg: T.greenDeep, symbol: "✓" }}
            value={attending}
            placeholder={defaults.label_attending ?? "Attending"}
            onChange={(v) => onChange({ ...copy, label_attending: v })}
          />
          <CopyField
            caption="Label on the button meaning “not coming” — locked to that meaning, only this text is yours"
            dot={{ bg: T.roseBg, fg: T.rose, symbol: "✕" }}
            value={declined}
            placeholder={defaults.label_declined ?? "Declined"}
            onChange={(v) => onChange({ ...copy, label_declined: v })}
          />
        </>
      )}

      {/* Live preview — same colors/icons as the guest portal, so a
          confusing reword is obvious here, not after it's live. */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 7 }}>
          Preview
        </div>
        <Card soft style={{ padding: "14px 15px" }}>
          <div className="u-serif" style={{ fontWeight: 600, fontSize: 16, color: T.ink }}>
            {title.trim() || defaults.title}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>
            {subtitle.trim() || defaults.subtitle}
          </div>
          {purpose === "primary" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: T.greenBg,
                  color: T.greenDeep,
                }}
              >
                ✓ {attending.trim() || defaults.label_attending}
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: T.roseBg,
                  color: T.rose,
                }}
              >
                ✗ {declined.trim() || defaults.label_declined}
              </span>
            </div>
          )}
        </Card>
      </div>
    </SectionBlock>
  );
}
