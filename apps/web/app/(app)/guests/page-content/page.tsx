"use client";

import { useEffect, useState } from "react";
import type { Wedding } from "@union/shared";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { useProfile } from "@/lib/profile";
import { fetchForms, fetchRoomBlocks } from "@/lib/data";
import { fetchEditableGuestPage, type EditableGuestPage } from "@/lib/guestPageData";
import { useLocale } from "@/lib/i18n/client";
import { getDictionary, LOCALES, type Locale } from "@/lib/i18n";
import { BackHeader } from "@/components/BackHeader";
import { Loading } from "@/components/ui";
import { FromSettings, type KnownFacts } from "./FromSettings";
import { MomentsEditor } from "./MomentsEditor";
import { DressEditor, TravelEditor, WelcomeEditor } from "./TextEditors";
import { FaqEditor } from "./FaqEditor";

/**
 * The couple's own content for the guest page, part by part. What the app
 * already knows (names, date, venue, address, deadline, stays) is
 * shown with its source instead of being asked again.
 */
export default function GuestPageContentPage() {
  const { wedding } = useWedding();
  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );
  return <Editor key={wedding.id} wedding={wedding} />;
}

function Editor({ wedding }: { wedding: Wedding }) {
  const { locale: uiLocale, t: dict } = useLocale();
  const t = dict.guests.pageContent;
  const { profile } = useProfile();
  const sourceLocale = wedding.default_locale || uiLocale;
  const [editing, setEditing] = useState<Locale>(uiLocale);
  const [content, setContent] = useState<EditableGuestPage | null>(null);
  const [facts, setFacts] = useState<KnownFacts | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetchEditableGuestPage(wedding.id, sourceLocale),
      fetchForms(wedding.id).catch(() => []),
      fetchRoomBlocks(wedding.id).catch(() => []),
    ])
      .then(([page, forms, stays]) => {
        if (!live) return;
        const rsvp = forms.find((f) => f.kind === "rsvp" && f.purpose === "primary");
        setContent(page);
        setFacts({
          rsvpClosesAt: rsvp?.closes_at ?? null,
          rsvpFormHref: rsvp ? `/guests/forms/${rsvp.id}` : "/guests/forms",
          staysCount: stays.length,
        });
      })
      .catch((e) => {
        console.error("Failed to load guest page content:", e);
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [wedding.id, sourceLocale]);

  const common = { weddingId: wedding.id, locale: editing, sourceLocale };

  return (
    <main className="u-main">
      <BackHeader title={t.title} subtitle={t.subtitle} fallback="/guests/modules" />

      {loadError ? (
        <div className="error" role="alert">
          {t.loadError}
        </div>
      ) : !content || !facts ? (
        <Loading label={dict.common.loading} />
      ) : (
        <>
          <FromSettings wedding={wedding} facts={facts} locale={uiLocale} />

          <div
            role="group"
            aria-label={t.writingIn}
            style={{
              position: "sticky",
              top: 8,
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "6px 6px 6px 14px",
              margin: "0 0 14px",
              borderRadius: 999,
              background: T.surface,
              border: `1px solid ${T.line3}`,
            }}
          >
            <span style={{ fontSize: 13, color: T.muted }}>{t.writingIn}</span>
            <span style={{ display: "flex", gap: 4 }}>
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={editing === code}
                  onClick={() => setEditing(code)}
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 999,
                    border: "none",
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: "pointer",
                    background: editing === code ? T.accent : "transparent",
                    color: editing === code ? T.white : T.ink2,
                  }}
                >
                  {getDictionary(uiLocale).lang[code]}
                </button>
              ))}
            </span>
          </div>

          <WelcomeEditor {...common} initial={content.page} />
          <MomentsEditor {...common} eventDate={wedding.event_date} initial={content.moments} />
          <TravelEditor {...common} initial={content.page} />
          <DressEditor {...common} initial={content.page} />
          <FaqEditor
            {...common}
            wedding={wedding}
            profile={profile ? { full_name: profile.full_name, phone: profile.phone } : null}
            initial={content.faq}
          />
        </>
      )}
    </main>
  );
}
