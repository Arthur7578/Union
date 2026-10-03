"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { T, alpha } from "@/lib/theme";
import type {
  Form,
  FormGuestCopy,
  LocalizedText,
  RsvpBlockCopy,
  RsvpQuestion,
} from "@union/shared";
import { isAutoTranslated, setTextForLocale, textForLocale } from "@union/shared";
import { useWedding } from "@/lib/wedding";
import {
  deleteForm,
  fetchForm,
  formGuestCopy,
  formQuestions,
  formStatus,
  rsvpCopy,
  updateForm,
  updateWedding,
} from "@/lib/data";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useLocale } from "@/lib/i18n/client";
import { getDictionary, LOCALES, type Locale } from "@/lib/i18n";
import { rsvpDefaults } from "@/lib/i18n/text";
import {
  applyTranslations,
  collectTranslatable,
  requestTranslations,
} from "@/lib/formTranslation";
import { BackHeader } from "@/components/BackHeader";
import { Card, Chip, Button, Loading, Switch, StatusPill } from "@/components/ui";

const KIND_LABEL: Record<RsvpQuestion["kind"], { label: string; bg: string; fg: string }> = {
  single: { label: "Single choice", bg: "#EEE7F0", fg: "#7A6690" },
  multi: { label: "Multiple choice", bg: "#E7EFE6", fg: "#5E7A63" },
  short: { label: "Short text", bg: "#FBEEE2", fg: "#B07C48" },
  comment: { label: "Open comment", bg: "#FBEEE2", fg: "#B07C48" },
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;
}

/** A one-language seed for text the couple is about to write. New questions
 *  and options start life in whichever language they're authoring in, not in
 *  the app's default — a French couple shouldn't have to delete an English
 *  "New question" before writing their own. */
function seed(locale: Locale, text: string): LocalizedText {
  return { [locale]: text };
}

/** The language name as that language writes it ("Français", not "French") —
 *  a tab label is read by whoever is switching to it. */
function localeName(locale: Locale): string {
  return getDictionary(locale).lang[locale];
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

/**
 * Which language the couple is writing in, and the one-click way to fill the
 * others.
 *
 * One switcher for the whole form rather than one per field: every
 * guest-facing string on the page follows it, so "now I'm writing the French
 * version" is a single decision instead of a per-input mode the couple has to
 * keep track of.
 */
function LanguageBar({
  editing,
  onEdit,
  onTranslate,
  translating,
  translateHint,
}: {
  editing: Locale;
  onEdit: (locale: Locale) => void;
  onTranslate: (target: Locale) => void;
  translating: boolean;
  translateHint: string | null;
}) {
  const others = LOCALES.filter((l) => l !== editing);
  return (
    <div
      style={{
        marginTop: 18,
        padding: "12px 14px",
        borderRadius: 16,
        background: T.surface,
        border: `1px solid ${T.line}`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Guest language
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
        {LOCALES.map((locale) => {
          const active = locale === editing;
          return (
            <button
              key={locale}
              type="button"
              onClick={() => onEdit(locale)}
              aria-pressed={active}
              style={{
                border: `1px solid ${active ? T.accentInk : T.line3}`,
                background: active ? T.accentInk : "transparent",
                color: active ? "#fff" : T.muted2,
                borderRadius: 20,
                padding: "6px 13px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {localeName(locale)}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 9, lineHeight: 1.45 }}>
        You&apos;re writing the <b style={{ color: T.ink2 }}>{localeName(editing)}</b>{" "}
        version. Each guest reads the language you recorded for them, or the
        one their device asks for — and anything you leave blank falls back to
        Union&apos;s own wording in that language.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, alignItems: "center" }}>
        {others.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => onTranslate(target)}
            disabled={translating}
            className="u-link"
            style={{ fontSize: 12.5, color: translating ? T.faint : T.accentInk }}
          >
            {translating
              ? "Translating…"
              : `Translate into ${localeName(target)} →`}
          </button>
        ))}
      </div>
      {translateHint && (
        <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 8, lineHeight: 1.45 }}>
          {translateHint}
        </div>
      )}
    </div>
  );
}

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { wedding, refresh } = useWedding();
  const { locale } = useLocale();
  const [form, setForm] = useState<Form | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [questions, setQuestions] = useState<RsvpQuestion[]>([]);
  const [rsvpCopyState, setRsvpCopyState] = useState<RsvpBlockCopy>({});
  const [guestCopyState, setGuestCopyState] = useState<FormGuestCopy>({});
  // Authoring starts in the couple's own app language — the version they're
  // most likely to write first.
  const [editingLocale, setEditingLocale] = useState<Locale>(locale);
  const [translating, setTranslating] = useState(false);
  const [translateHint, setTranslateHint] = useState<string | null>(null);
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
        setGuestCopyState(formGuestCopy(f));
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
          options: needsOptions
            ? q.options ?? [
                { id: newId(), label: seed(editingLocale, "Option 1") },
                { id: newId(), label: seed(editingLocale, "Option 2") },
              ]
            : q.options,
        };
      }),
    );
    markDirty();
  };

  /** Rewrite one question's title in the language being edited. */
  const patchQuestionTitle = (id: string, text: string) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? { ...q, title: setTextForLocale(q.title, editingLocale, text) }
          : q,
      ),
    );
    markDirty();
  };

  /** Rewrite one option's label. The option's id never changes, so answers
   *  already given keep pointing at this choice however it's reworded. */
  const patchOptionLabel = (questionId: string, optionId: string, text: string) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: (q.options ?? []).map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      label: setTextForLocale(option.label, editingLocale, text),
                    }
                  : option,
              ),
            }
          : q,
      ),
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
        title: seed(editingLocale, "New question"),
        required: false,
        options:
          kind === "single" || kind === "multi"
            ? [
                { id: newId(), label: seed(editingLocale, "Option 1") },
                { id: newId(), label: seed(editingLocale, "Option 2") },
              ]
            : undefined,
      },
    ]);
    markDirty();
  };

  /**
   * Fill another language from the one on screen.
   *
   * Only touches slots that are empty or hold a previous machine translation
   * — anything a person typed in the target language is left exactly as they
   * wrote it. Nothing is saved here: the results land in the form as editable,
   * badged drafts, and the couple still presses Save.
   */
  const translateInto = async (target: Locale) => {
    if (translating) return;
    setTranslating(true);
    setTranslateHint(null);
    setError(null);
    const draft = {
      rsvpCopy: rsvpCopyState,
      guestCopy: guestCopyState,
      questions,
    };
    try {
      const slots = collectTranslatable(draft, editingLocale, target);
      if (slots.length === 0) {
        setTranslateHint(
          `Nothing to translate — every ${localeName(target)} field is already written by hand.`,
        );
        return;
      }
      const supabase = getBrowserSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("You're signed out.");

      const translations = await requestTranslations(
        slots,
        editingLocale,
        target,
        accessToken,
      );
      const filled = Object.keys(translations).length;
      if (filled === 0) {
        setTranslateHint("The translator came back empty — nothing changed.");
        return;
      }
      // Applied through functional updates, each against the live value, so a
      // keystroke that landed while the request was in flight isn't clobbered
      // by the snapshot we sent off.
      const apply = (partial: Partial<typeof draft>) =>
        applyTranslations({ ...draft, ...partial }, translations, editingLocale, target);
      setRsvpCopyState((prev) => apply({ rsvpCopy: prev }).rsvpCopy);
      setGuestCopyState((prev) => apply({ guestCopy: prev }).guestCopy);
      setQuestions((prev) => apply({ questions: prev }).questions);
      markDirty();
      setEditingLocale(target);
      setTranslateHint(
        `Filled ${filled} ${localeName(target)} field${filled === 1 ? "" : "s"}. They're marked "Auto" — read them, then save.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't translate this form.",
      );
    } finally {
      setTranslating(false);
    }
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
        ...(form.kind === "rsvp"
          ? { rsvp_copy: rsvpCopyState }
          : { guest_copy: guestCopyState }),
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
        kicker="Organiser only · your own name for this form"
        hint={
          form.kind === "custom"
            ? "This name is how you find the form. Guests see the headline you write below — or this name, if you leave it blank."
            : "The name and schedule are for you — guests never see them."
        }
        tone={{ bg: T.sandBg, border: "rgba(169,154,144,.35)", fg: T.sand }}
      >
        <Card style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 5 }}>
            Form name
          </div>
          <input
            type="text"
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
              padding: "8px 10px",
              minHeight: 40,
              border: `1px solid ${T.line3}`,
              borderRadius: 10,
              background: "#F7F1EC",
            }}
          />
        </Card>

        <Card style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 9 }}>
            When it&apos;s open
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>Opens</label>
              <input
                type="date"
                value={opensAt}
                onChange={(e) => {
                  setOpensAt(e.target.value);
                  markDirty();
                }}
                style={{
                  marginTop: 4,
                  minHeight: 38,
                  padding: "8px 10px",
                  fontSize: 14,
                  border: `1px solid ${T.line}`,
                  borderRadius: 10,
                  background: T.surface,
                  color: T.ink,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>Closes</label>
              <input
                type="date"
                value={closesAt}
                onChange={(e) => {
                  setClosesAt(e.target.value);
                  markDirty();
                }}
                style={{
                  marginTop: 4,
                  minHeight: 38,
                  padding: "8px 10px",
                  fontSize: 14,
                  border: `1px solid ${T.line}`,
                  borderRadius: 10,
                  background: T.surface,
                  color: T.ink,
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 8 }}>
            Leave either blank for no limit. Come back here to shift the
            dates — there&apos;s no separate timeline to manage.
          </div>
        </Card>
      </SectionBlock>

      {/* ---------------- Which language you're writing ---------------- */}
      <LanguageBar
        editing={editingLocale}
        onEdit={setEditingLocale}
        onTranslate={translateInto}
        translating={translating}
        translateHint={translateHint}
      />

      {/* ---------------- RSVP block wording (guarded) ---------------- */}
      {form.kind === "rsvp" && (
        <RsvpWordingEditor
          purpose={form.purpose === "reconfirmation" ? "reconfirmation" : "primary"}
          copy={rsvpCopyState}
          locale={editingLocale}
          allowMaybe={wedding.allow_rsvp_maybe}
          onChange={(next) => {
            setRsvpCopyState(next);
            markDirty();
          }}
        />
      )}

      {/* ---------------- Custom form headline (guarded) ---------------- */}
      {form.kind === "custom" && (
        <SectionBlock
          kicker="Form heading · what guests see"
          hint="The heading guests read above the questions. Leave it blank and they see the form name instead — untranslated, as before."
          tone={{ bg: T.accentSoft, border: T.accentBorder, fg: T.accentInk }}
        >
          <CopyField
            caption={`Heading guests see · ${localeName(editingLocale)}`}
            value={textForLocale(guestCopyState.title, editingLocale)}
            placeholder={title.trim() || form.title}
            auto={isAutoTranslated(guestCopyState.title, editingLocale)}
            onChange={(v) => {
              setGuestCopyState((prev) => ({
                ...prev,
                title: setTextForLocale(prev.title, editingLocale, v),
              }));
              markDirty();
            }}
          />
          <CopyField
            caption={`Supporting line · ${localeName(editingLocale)}`}
            value={textForLocale(guestCopyState.subtitle, editingLocale)}
            placeholder="Optional — a line of context under the heading"
            auto={isAutoTranslated(guestCopyState.subtitle, editingLocale)}
            onChange={(v) => {
              setGuestCopyState((prev) => ({
                ...prev,
                subtitle: setTextForLocale(prev.subtitle, editingLocale, v),
              }));
              markDirty();
            }}
          />
        </SectionBlock>
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
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={q.required}
                    onClick={() => patchQuestion(q.id, { required: !q.required })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        borderRadius: 5,
                        border: `1.5px solid ${q.required ? T.accentInk : "rgba(67,53,58,.28)"}`,
                        background: q.required ? T.accentInk : "transparent",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        transition: "background .12s ease, border-color .12s ease",
                      }}
                    >
                      {q.required ? "✓" : ""}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: q.required ? T.accentInk : T.faint }}>
                      Required
                    </span>
                  </button>
                </div>
              </div>

              {isAutoTranslated(q.title, editingLocale) && (
                <div style={{ marginTop: 11, display: "flex" }}>
                  <AutoBadge />
                </div>
              )}
              <input
                type="text"
                value={textForLocale(q.title, editingLocale)}
                onChange={(e) => patchQuestionTitle(q.id, e.target.value)}
                placeholder={`Question title (${localeName(editingLocale)})`}
                className="u-serif"
                style={{
                  fontFamily: T.serif,
                  fontWeight: 600,
                  fontSize: 18,
                  color: T.ink,
                  padding: "8px 10px",
                  marginTop: 11,
                  minHeight: 40,
                  border: `1px solid ${T.line3}`,
                  borderRadius: 10,
                  background: "#F7F1EC",
                }}
              />

              {(q.kind === "single" || q.kind === "multi") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
                  {(q.options ?? []).map((opt) => (
                    <div key={opt.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="text"
                        value={textForLocale(opt.label, editingLocale)}
                        onChange={(e) => patchOptionLabel(q.id, opt.id, e.target.value)}
                        placeholder={localeName(editingLocale)}
                        style={{
                          flex: 1,
                          minHeight: 36,
                          padding: "6px 12px",
                          fontSize: 13,
                          color: T.ink,
                          border: "1px solid rgba(67,53,58,.08)",
                          borderRadius: 10,
                          background: "#F7F1EC",
                        }}
                      />
                      {isAutoTranslated(opt.label, editingLocale) && <AutoBadge />}
                      <button
                        onClick={() => {
                          // Removing a choice orphans any answer already
                          // pointing at it — deliberate, and the same
                          // trade-off as before ids existed.
                          patchQuestion(q.id, {
                            options: (q.options ?? []).filter((o) => o.id !== opt.id),
                          });
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
                        options: [
                          ...(q.options ?? []),
                          {
                            id: newId(),
                            label: seed(
                              editingLocale,
                              `Option ${(q.options?.length ?? 0) + 1}`,
                            ),
                          },
                        ],
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
          <>
            <MaybeAnswerRight wedding={wedding} refresh={refresh} />
            <ExtraGuestsRights wedding={wedding} refresh={refresh} />
          </>
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

/** The third reply.
 *
 *  Off by default, because a third answer changes what a headcount means: a
 *  couple whose caterer needs a firm number by a date would rather chase an
 *  unsure guest than bank an unsure yes. A couple running a destination
 *  weekend has the opposite problem — forcing yes/no eight months out gets
 *  them answers that are guesses, revised later as a silent status flip that
 *  carries no hint the guest was ever unsure.
 *
 *  Saves immediately rather than waiting for the form's Save button: it is a
 *  wedding setting rather than form content, which is the same reason
 *  ExtraGuestsRights below saves on the spot. */
function MaybeAnswerRight({
  wedding,
  refresh,
}: {
  wedding: NonNullable<ReturnType<typeof useWedding>["wedding"]>;
  refresh: () => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const on = wedding.allow_rsvp_maybe;

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      await updateWedding(wedding.id, { allow_rsvp_maybe: !on });
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
        A “maybe” answer
      </div>
      <div style={{ fontSize: 12, color: T.faint, marginTop: 3, lineHeight: 1.45 }}>
        With this on, guests get a third reply for “I don&apos;t know yet”
        instead of having to guess. You see those guests as their own count, so
        your headcount reads as a range rather than one number you can&apos;t
        trust.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, opacity: saving ? 0.6 : 1 }}>
        <Switch
          on={on}
          onChange={toggle}
          label="Guests may answer “maybe”"
        />
        <span style={{ fontSize: 13, color: T.ink }}>
          Guests may answer &ldquo;maybe&rdquo;
        </span>
      </div>

      <div style={{ fontSize: 11.5, color: T.faint, marginTop: 10, lineHeight: 1.45 }}>
        {on ? (
          <>
            Reword the button above, under the RSVP block. A late{" "}
            <Link href="/guests/forms" className="u-link" style={{ color: T.accentInk }}>
              reconfirmation form
            </Link>{" "}
            is the usual way to turn maybes into firm answers near the day.
          </>
        ) : (
          <>
            Turning this off stops new &ldquo;maybe&rdquo; replies. It never
            rewrites ones already given — those guests stay as maybes until
            they answer again, since converting them would invent a commitment
            they never made.
          </>
        )}
      </div>

      {err && <div style={{ color: "#C0553B", fontSize: 12, marginTop: 8 }}>{err}</div>}
    </Card>
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

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, opacity: saving ? 0.6 : 1 }}>
        <Switch
          on={wedding.allow_guests_add_partner}
          onChange={() => !saving && patch({ allow_guests_add_partner: !wedding.allow_guests_add_partner })}
          label="Guests may add a partner by default"
        />
        <span style={{ fontSize: 13, color: T.ink }}>
          Guests may add a partner by default
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, opacity: saving ? 0.6 : 1 }}>
        <Switch
          on={wedding.allow_guests_add_children}
          onChange={() => !saving && patch({ allow_guests_add_children: !wedding.allow_guests_add_children })}
          label="Guests may add children by default"
        />
        <span style={{ fontSize: 13, color: T.ink }}>
          Guests may add children by default
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/guests/permissions" className="u-link" style={{ fontSize: 12.5, color: T.accentInk }}>
          Manage per-guest overrides →
        </Link>
      </div>

      {err && <div style={{ color: "#C0553B", fontSize: 12, marginTop: 8 }}>{err}</div>}
    </Card>
  );
}

/** Marks wording the translator wrote, until a person edits it. A machine
 *  translation of a wedding invitation is a draft, and the couple deserves to
 *  see which lines are still drafts. */
function AutoBadge() {
  return (
    <span
      title="Translated automatically — worth a read before you publish."
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#B07C48",
        background: "#FBEEE2",
        borderRadius: 6,
        padding: "3px 6px",
      }}
    >
      Auto
    </span>
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
  auto,
  onChange,
}: {
  caption: string;
  dot?: { bg: string; fg: string; symbol: string };
  value: string;
  placeholder: string;
  /** This locale's text came from the translator and hasn't been read yet. */
  auto?: boolean;
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
        {auto && <AutoBadge />}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          minHeight: 38,
          padding: "8px 10px",
          fontSize: 14,
          color: T.ink,
          border: `1px solid ${T.line3}`,
          borderRadius: 10,
          background: "#F7F1EC",
        }}
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
  locale,
  allowMaybe,
  onChange,
}: {
  purpose: "primary" | "reconfirmation";
  copy: RsvpBlockCopy;
  /** The language being written and previewed. */
  locale: Locale;
  /** Whether this wedding offers "maybe" — the third label and the third
   *  preview button appear only when there's a button to reword. Wording
   *  already written stays stored either way, so switching the option back on
   *  brings the couple's own phrasing with it. */
  allowMaybe: boolean;
  onChange: (next: RsvpBlockCopy) => void;
}) {
  const defaults = rsvpDefaults(locale, purpose);
  const title = textForLocale(copy.title, locale);
  const subtitle = textForLocale(copy.subtitle, locale);
  const attending = textForLocale(copy.label_attending, locale);
  const maybe = textForLocale(copy.label_maybe, locale);
  const declined = textForLocale(copy.label_declined, locale);

  /** Every slot writes through here so a hand edit always lands in the
   *  language on screen — and clears that slot's "auto" flag. */
  const write = (slot: keyof RsvpBlockCopy, text: string) =>
    onChange({ ...copy, [slot]: setTextForLocale(copy[slot], locale, text) });

  return (
    <SectionBlock
      kicker={purpose === "primary" ? "RSVP block · what guests see" : "Reconfirmation block · what guests see"}
      hint={
        purpose === "primary"
          ? allowMaybe
            ? "Reword the headline and the three reply buttons — the reply itself (and everything it triggers) stays wired to the real RSVP."
            : "Reword the headline and the two reply buttons — the reply itself (and everything it triggers) stays wired to the real RSVP."
          : "Reword the framing for this late check-in. It reuses the main RSVP's reply buttons."
      }
      tone={{ bg: T.accentSoft, border: T.accentBorder, fg: T.accentInk }}
    >
      <CopyField
        caption={`Headline guests see · ${localeName(locale)}`}
        value={title}
        placeholder={defaults.title}
        auto={isAutoTranslated(copy.title, locale)}
        onChange={(v) => write("title", v)}
      />
      <CopyField
        caption={`Supporting line · ${localeName(locale)}`}
        value={subtitle}
        placeholder={defaults.subtitle}
        auto={isAutoTranslated(copy.subtitle, locale)}
        onChange={(v) => write("subtitle", v)}
      />

      {purpose === "primary" && (
        <>
          <CopyField
            caption={`Label on the button meaning “coming” · ${localeName(locale)} — locked to that meaning, only this text is yours`}
            dot={{ bg: T.greenBg, fg: T.greenDeep, symbol: "✓" }}
            value={attending}
            placeholder={defaults.labelAttending}
            auto={isAutoTranslated(copy.label_attending, locale)}
            onChange={(v) => write("label_attending", v)}
          />
          {allowMaybe && (
            <CopyField
              caption={`Label on the button meaning “not sure yet” · ${localeName(locale)} — locked to that meaning, only this text is yours`}
              dot={{ bg: T.blueBg, fg: T.blueInk, symbol: "~" }}
              value={maybe}
              placeholder={defaults.labelMaybe}
              auto={isAutoTranslated(copy.label_maybe, locale)}
              onChange={(v) => write("label_maybe", v)}
            />
          )}
          <CopyField
            caption={`Label on the button meaning “not coming” · ${localeName(locale)} — locked to that meaning, only this text is yours`}
            dot={{ bg: T.roseBg, fg: T.rose, symbol: "✕" }}
            value={declined}
            placeholder={defaults.labelDeclined}
            auto={isAutoTranslated(copy.label_declined, locale)}
            onChange={(v) => write("label_declined", v)}
          />
        </>
      )}

      {/* Live preview — same colors/icons as the guest portal, so a
          confusing reword is obvious here, not after it's live. */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginBottom: 7 }}>
          Preview · what a {localeName(locale)} guest reads
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
                  border: `1px solid ${alpha(T.green, 0.35)}`,
                }}
              >
                ✓ {attending.trim() || defaults.labelAttending}
              </span>
              {allowMaybe && (
                <span
                  style={{
                    flex: 1,
                    textAlign: "center",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: T.blueBg,
                    color: T.blueInk,
                    border: `1px solid ${alpha(T.blueInk, 0.28)}`,
                  }}
                >
                  ~ {maybe.trim() || defaults.labelMaybe}
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: T.accentPink,
                  color: T.accentInk,
                  border: `1px solid ${T.accentBorder}`,
                }}
              >
                ✗ {declined.trim() || defaults.labelDeclined}
              </span>
            </div>
          )}
        </Card>
      </div>
    </SectionBlock>
  );
}
