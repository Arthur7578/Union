"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { useWedding } from "@/lib/wedding";
import { useLocale } from "@/lib/i18n/client";
import { fetchCollaborators } from "@/lib/data";
import { initial, formatShortDate } from "@/lib/format";
import { ujOpenWidget } from "@/lib/userjot";
import { PageHeader, Card, SectionLabel, Avatar, Button } from "@/components/ui";
import { SampleBadge } from "@/components/SampleBadge";
import { ChevronRight, Spark } from "@/components/icons";

const rowStyle: React.CSSProperties = {
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 15px",
  width: "100%",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
};

export default function AccountPage() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { profile } = useProfile();
  const { wedding } = useWedding();
  const { locale, t } = useLocale();
  const [teamCount, setTeamCount] = useState(1);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchCollaborators(wedding.id)
      .then((c) => ok && setTeamCount(1 + c.length))
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;

  const name = profile?.full_name || wedding.partner_one || t.account.title;
  const email = session?.user?.email ?? "";
  const coupleLine =
    [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
    t.account.weddingRowFallback;
  const weddingSub =
    wedding.event_date || wedding.venue_name
      ? [wedding.venue_name, formatShortDate(wedding.event_date, locale)]
          .filter(Boolean)
          .join(" · ")
      : t.account.weddingRowFallback;

  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <main className="u-main">
      <PageHeader kicker={t.account.kicker} title={t.account.title} />

      <Link href="/account/profile" style={{ textDecoration: "none" }}>
        <Card
          onClick={() => {}}
          style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, padding: "18px 16px" }}
        >
          <Avatar letter={initial(name)} size={58} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u-serif" style={{ fontWeight: 600, fontSize: 22, color: T.ink }}>
              {name}
            </div>
            {email && (
              <div style={{ fontSize: 13, color: T.faint, marginTop: 1 }}>{email}</div>
            )}
          </div>
          <ChevronRight size={18} stroke="#CBBCB6" />
        </Card>
      </Link>

      <SectionLabel>{t.account.weddingSection}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <Link href="/account/wedding" style={{ ...rowStyle, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{coupleLine}</div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{weddingSub}</div>
          </div>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </Link>
        <Link href="/plan/team" style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
              {t.account.teamRowTitle}
            </span>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
              {t.account.teamRowSub(teamCount)}
            </div>
          </div>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </Link>
      </div>

      {/* Union Plus — no billing backend yet, clearly marked as a preview */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 22,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: "18px 18px 16px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Spark size={15} color={T.accent} />
            <span
              style={{
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.accentInk,
              }}
            >
              {t.account.plusKicker}
            </span>
          </div>
          <SampleBadge />
        </div>
        <div className="u-serif" style={{ fontWeight: 600, fontSize: 23, color: T.ink, marginTop: 9, lineHeight: 1.15 }}>
          {t.account.plusTitle}
        </div>
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 6, lineHeight: 1.5 }}>
          {t.account.plusBody}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ fontSize: 12.5, color: T.muted2 }}>{t.account.plusRenews}</div>
          <Button disabled style={{ height: 38, padding: "0 16px", fontSize: 13 }}>
            {t.account.managePlan}
          </Button>
        </div>
      </div>

      <SectionLabel>{t.account.accountSection}</SectionLabel>
      <div style={{ borderRadius: 18, background: T.surface, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ ...rowStyle, borderBottom: `1px solid ${T.line}`, cursor: "default" }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>
            {t.account.billing}
          </span>
          <SampleBadge />
        </div>
        <Link href="/account/settings" style={{ ...rowStyle, borderBottom: `1px solid ${T.line}` }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>
            {t.account.settingsRow}
          </span>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </Link>
        <Link href="/account/settings/notifications" style={{ ...rowStyle, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
              {t.account.notificationsRow}
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
              {t.account.notificationsSub}
            </div>
          </div>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </Link>
        <Link href="/account/privacy" style={{ ...rowStyle, borderBottom: `1px solid ${T.line}` }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>
            {t.account.privacyRow}
          </span>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </Link>
        <button onClick={ujOpenWidget} style={rowStyle}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink, flex: 1 }}>
            {t.account.helpRow}
          </span>
          <ChevronRight size={16} stroke="#CBBCB6" />
        </button>
      </div>

      <Button
        variant="secondary"
        style={{ width: "100%", marginTop: 14, color: T.accentInk }}
        onClick={doSignOut}
      >
        {t.common.signOut}
      </Button>
      <div style={{ textAlign: "center", fontSize: 11.5, color: T.label, padding: "14px 0 4px" }}>
        {t.account.version}
      </div>
    </main>
  );
}
