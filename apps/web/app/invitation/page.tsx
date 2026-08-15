"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Wedding } from "@union/shared";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/client";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";

function weddingName(wedding: Wedding, fallback: string): string {
  return (
    [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
    fallback
  );
}

export default function InvitationPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { session, loading: authLoading, signOut } = useAuth();
  const {
    weddings,
    invitedWeddingId,
    invitedWedding,
    selectionIssue,
    loading: weddingLoading,
    setWedding,
  } = useWedding();

  useEffect(() => {
    if (!authLoading && !session) router.replace("/sign-in");
  }, [authLoading, session, router]);

  if (authLoading || weddingLoading || !session) {
    return (
      <main className="page">
        <div className="card" style={{ maxWidth: 620 }}>
          <Loading label={t.invitation.loading} />
        </div>
      </main>
    );
  }

  const otherWeddings = weddings.filter((w) => w.id !== invitedWeddingId);
  const choose = (selected: Wedding) => {
    setWedding(selected);
    router.replace("/today");
  };
  const roleFor = (wedding: Wedding) =>
    wedding.owner_id === session.user.id
      ? t.weddingPicker.owner
      : t.weddingPicker.coOrganiser;
  const detailFor = (wedding: Wedding) =>
    [wedding.venue_name, formatShortDate(wedding.event_date, locale)]
      .filter(Boolean)
      .join(" · ");
  const signOutAndSwitch = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <main className="page">
      <div className="card" style={{ maxWidth: 620 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              color: T.label,
              fontWeight: 700,
              fontSize: 11.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <Spark size={15} color={T.accent} /> {t.invitation.kicker}
          </div>
          <h1
            className="u-serif"
            style={{
              fontSize: 34,
              lineHeight: 1.08,
              fontWeight: 600,
              color: T.ink,
              margin: "12px 0 8px",
            }}
          >
            {invitedWedding
              ? t.invitation.title(
                  weddingName(invitedWedding, t.weddingPicker.untitled),
                )
              : t.invitation.unavailableTitle}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {invitedWedding
              ? t.invitation.sub
              : t.invitation.unavailableBody}
          </p>
        </div>

        {selectionIssue === "invited_wedding_unavailable" && (
          <div className="error" style={{ marginBottom: 16 }}>
            {t.weddingPicker.invitedUnavailable}
          </div>
        )}

        {invitedWedding && (
          <section
            style={{
              background: "linear-gradient(150deg,#F8EDEA 0%,#F1DFDE 100%)",
              border: `1px solid ${T.line}`,
              borderRadius: 22,
              padding: 18,
              boxShadow: "0 10px 26px rgba(67,53,58,.08)",
            }}
          >
            <div
              style={{
                color: T.label,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {t.invitation.invitedWedding}
            </div>
            <div
              className="u-serif"
              style={{ fontSize: 27, fontWeight: 600, color: T.ink, marginTop: 5 }}
            >
              {weddingName(invitedWedding, t.weddingPicker.untitled)}
            </div>
            <div style={{ color: T.ink2, fontSize: 13, marginTop: 3 }}>
              {[roleFor(invitedWedding), detailFor(invitedWedding)]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <Button
              type="button"
              onClick={() => choose(invitedWedding)}
              style={{ width: "100%", marginTop: 16 }}
            >
              {t.invitation.openInvited}
            </Button>
          </section>
        )}

        {otherWeddings.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2
              className="u-serif"
              style={{ fontSize: 23, color: T.ink, margin: 0, fontWeight: 600 }}
            >
              {t.invitation.otherTitle}
            </h2>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.45, margin: "4px 0 12px" }}>
              {t.invitation.otherSub}
            </p>
            <div style={{ display: "grid", gap: 9 }}>
              {otherWeddings.map((wedding) => (
                <button
                  type="button"
                  key={wedding.id}
                  onClick={() => choose(wedding)}
                  aria-label={`${t.invitation.openOther}: ${weddingName(
                    wedding,
                    t.weddingPicker.untitled,
                  )}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 15px",
                    textAlign: "left",
                    background: T.surface,
                    border: `1px solid ${T.line}`,
                    borderRadius: 18,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="u-serif"
                      style={{ fontSize: 20, fontWeight: 600, color: T.ink }}
                    >
                      {weddingName(wedding, t.weddingPicker.untitled)}
                    </div>
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                      {[roleFor(wedding), detailFor(wedding)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span style={{ color: T.accent, fontWeight: 700, fontSize: 18 }}>
                    →
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {session.user.email && (
          <p style={{ textAlign: "center", color: T.faint, fontSize: 12.5, margin: "20px 0 0" }}>
            {t.invitation.signedInAs(session.user.email)}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={signOutAndSwitch}
          style={{ width: "100%", marginTop: 10 }}
        >
          {t.invitation.differentAccount}
        </Button>
      </div>
    </main>
  );
}
