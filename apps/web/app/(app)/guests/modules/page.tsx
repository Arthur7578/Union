"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GUEST_MODULE_KEYS,
  partHasContent,
  resolveGuestModules,
  toStoredGuestModules,
  type GuestModuleKey,
  type GuestModules,
  type Form,
  type Wedding,
} from "@union/shared";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { fetchForms, fetchRoomBlocks, formStatus, updateWedding } from "@/lib/data";
import { fetchEditableGuestPage, type EditableGuestPage } from "@/lib/guestPageData";
import { useLocale } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { organiserRsvpStatus } from "@/lib/rsvpNotes";
import { Button, SectionLabel, Switch, Loading } from "@/components/ui";

/** Where each part's content is written, on the guest page content screen. */
const EDIT_HREF: Partial<Record<GuestModuleKey, string>> = {
  word: "/guests/page-content#pc-welcome",
  weekend: "/guests/page-content#pc-weekend",
  venue: "/guests/page-content#pc-travel",
  dress: "/guests/page-content#pc-dress",
  faq: "/guests/page-content#pc-faq",
};

/**
 * The organiser's view of the wedding page: the faire-part opens it, the
 * reply ends it, and in between a switch per part. Turning a part off hides
 * it for every guest; it's presentation only, so nothing a guest has sent is
 * touched. A part that is on but has nothing written in it is not shown to
 * guests, and is marked as such here.
 */
export default function GuestModulesPage() {
  const { wedding, refresh } = useWedding();

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  return <GuestModulesForm key={wedding.id} wedding={wedding} refresh={refresh} />;
}

const box: React.CSSProperties = {
  borderRadius: 18,
  background: T.surface,
  border: `1px solid ${T.line}`,
  overflow: "hidden",
};

function Row({
  title,
  sub,
  status,
  statusTone,
  action,
  last,
}: {
  title: string;
  sub: string;
  status?: string;
  statusTone?: "on" | "off" | "warn";
  action?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 15px",
        borderBottom: last ? "none" : `1px solid ${T.line}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{sub}</div>
        {status ? (
          <div
            style={{
              fontSize: 11.5,
              marginTop: 5,
              fontWeight: 600,
              color: statusTone === "on" ? T.green : statusTone === "warn" ? T.accentInk : T.faint,
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const editLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 6px",
  fontSize: 13,
  fontWeight: 600,
  color: T.accentInk,
  textDecoration: "none",
};

function GuestModulesForm({ wedding, refresh }: { wedding: Wedding; refresh: () => Promise<void> }) {
  const { t: dict, locale } = useLocale();
  const t = dict.guests.modules;
  const [modules, setModules] = useState<GuestModules>(() => resolveGuestModules(wedding.guest_modules));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // What is written in each part, to tell "ready" from "empty". Unknown while
  // it loads, or if it fails: the switches work without it.
  const [content, setContent] = useState<(EditableGuestPage & { stays: unknown[] }) | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([fetchEditableGuestPage(wedding.id, wedding.default_locale || locale), fetchRoomBlocks(wedding.id)])
      .then(([page, stays]) => live && setContent({ ...page, stays }))
      .catch((e) => console.error("Failed to load guest page content:", e));
    return () => {
      live = false;
    };
  }, [wedding.id, wedding.default_locale, locale]);

  // The RSVP's window: guests can only reply while it is open, so a closed or
  // unpublished RSVP is said here, with the way to its dates.
  const [rsvp, setRsvp] = useState<Form | null>(null);
  useEffect(() => {
    let live = true;
    fetchForms(wedding.id)
      .then((forms) => live && setRsvp(forms.find((f) => f.kind === "rsvp" && f.purpose === "primary") ?? null))
      .catch((e) => console.error("Failed to load the RSVP form:", e));
    return () => {
      live = false;
    };
  }, [wedding.id]);
  const rsvpState = rsvp ? formStatus(rsvp) : null;
  const rsvpStatus = organiserRsvpStatus(rsvp, rsvpState, locale, t);
  const rsvpHref = rsvp ? `/guests/forms/${rsvp.id}` : "/guests/forms";
  const rsvpBlocked = rsvpStatus.blocked;

  const hasContent = (key: GuestModuleKey) =>
    content
      ? partHasContent(key, {
          page: content.page,
          moments: content.moments,
          faq: content.faq,
          stays: content.stays,
          venueName: wedding.venue_name,
          address: wedding.address_city || wedding.address_area,
        })
      : null;

  const toggle = (key: GuestModuleKey) => {
    setError(null);
    setSaved(false);
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Only the "off" decisions are stored, so a part added to the page
      // later starts out on instead of silently missing.
      await updateWedding(wedding.id, { guest_modules: toStoredGuestModules(modules) });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  };

  const status = (key: GuestModuleKey): { text: string; tone: "on" | "off" | "warn" } => {
    if (!modules[key]) return { text: t.deactivated, tone: "off" };
    const filled = hasContent(key);
    if (key === "travel" || filled === null) return { text: t.activated, tone: "on" };
    return filled ? { text: t.ready, tone: "on" } : { text: t.empty, tone: "warn" };
  };

  return (
    <main className="u-main">
      <BackHeader title={t.title} subtitle={t.subtitle} fallback="/guests" />

      <Link
        href="/guest/preview"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          margin: "0 0 18px",
          borderRadius: 999,
          border: `1px solid ${T.accentBorder}`,
          background: T.surface,
          color: T.accentInk,
          fontWeight: 600,
          fontSize: 14.5,
          textDecoration: "none",
        }}
      >
        {t.previewAsGuest}
      </Link>

      <form onSubmit={save}>
        <SectionLabel style={{ marginTop: 0 }}>{t.openingLabel}</SectionLabel>
        <div style={box}>
          <Row title={t.openingTitle} sub={t.openingSub} status={t.always} statusTone="on" last />
        </div>

        <SectionLabel>{t.partsLabel}</SectionLabel>
        <div style={box} role="group" aria-label={t.partsLabel}>
          {GUEST_MODULE_KEYS.map((key, i) => {
            const s = status(key);
            const href = EDIT_HREF[key];
            return (
              <Row
                key={key}
                title={t.parts[key].label}
                sub={t.parts[key].sub}
                status={s.text}
                statusTone={s.tone}
                last={i === GUEST_MODULE_KEYS.length - 1}
                action={
                  <>
                    {href ? (
                      <Link href={href} style={editLink} aria-label={`${t.edit} · ${t.parts[key].label}`}>
                        {t.edit}
                      </Link>
                    ) : null}
                    <Switch on={modules[key]} onChange={() => toggle(key)} label={t.parts[key].label} />
                  </>
                }
              />
            );
          })}
        </div>

        <SectionLabel>{t.replyLabel}</SectionLabel>
        <div style={box}>
          <Row
            title={t.replyTitle}
            sub={t.replySub}
            status={rsvpStatus.text}
            statusTone={rsvpStatus.tone}
            last
            action={
              <Link
                href={rsvpHref}
                style={editLink}
                aria-label={`${rsvpBlocked ? t.replyEditDates : t.edit} · ${t.replyTitle}`}
              >
                {rsvpBlocked ? t.replyEditDates : t.edit}
              </Link>
            }
          />
        </div>

        <div style={{ fontSize: 12, color: T.faint, margin: "10px 4px 14px" }}>{t.previewNote}</div>

        {error && (
          <div className="error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}

        <Button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? t.saving : saved ? t.saved : t.save}
        </Button>
      </form>
    </main>
  );
}
