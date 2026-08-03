"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { BackHeader } from "@/components/BackHeader";
import { Card, SectionLabel, Button, Avatar, StatusPill, Loading } from "@/components/ui";
import { Spark } from "@/components/icons";
import { useWedding } from "@/lib/wedding";
import { useProfile } from "@/lib/profile";
import { useLocale } from "@/lib/i18n/client";
import { initial, timeAgo } from "@/lib/format";
import {
  fetchCollaborators,
  inviteCollaborator,
  removeCollaborator,
  fetchActivity,
  updateWedding,
  type CollaboratorWithProfile,
} from "@/lib/data";
import type { ActivityLogEntry, Autonomy } from "@union/shared";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function TeamPage() {
  const { t, locale } = useLocale();
  const { wedding, setWedding } = useWedding();
  const { profile } = useProfile();

  const [collaborators, setCollaborators] = useState<CollaboratorWithProfile[] | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[] | null>(null);

  const [email, setEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [autonomyBusy, setAutonomyBusy] = useState(false);
  const [autonomyError, setAutonomyError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchCollaborators(wedding.id)
      .then((c) => ok && setCollaborators(c))
      .catch(() => ok && setCollaborators([]));
    fetchActivity(wedding.id)
      .then((a) => ok && setActivity(a))
      .catch(() => ok && setActivity([]));
    return () => {
      ok = false;
    };
  }, [wedding]);

  if (!wedding) return null;

  const ownerName = profile?.full_name || wedding.partner_one || t.account.title;
  const teamCount = 1 + (collaborators?.length ?? 0);

  const refreshActivity = () => {
    fetchActivity(wedding.id)
      .then(setActivity)
      .catch(() => {});
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!EMAIL_RE.test(clean)) {
      setInviteError(t.plan.inviteInvalid);
      return;
    }
    setInviteBusy(true);
    setInviteError(null);
    try {
      const row = await inviteCollaborator(wedding.id, clean);
      setCollaborators((prev) => [...(prev ?? []), row]);
      setEmail("");
      refreshActivity();
    } catch (err) {
      setInviteError(
        err instanceof Error && err.message === "Already invited."
          ? t.plan.inviteDuplicate
          : t.plan.inviteError,
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const cancelInvite = async (id: string) => {
    const prev = collaborators;
    setCollaborators((cur) => (cur ?? []).filter((c) => c.id !== id));
    try {
      await removeCollaborator(id);
    } catch {
      setCollaborators(prev ?? null);
    }
  };

  const AUTONOMY: { key: Autonomy; label: string; desc: string }[] = [
    { key: "ask", label: t.plan.autonomyAsk, desc: t.plan.autonomyDescAsk },
    { key: "suggest", label: t.plan.autonomySuggest, desc: t.plan.autonomyDescSuggest },
    { key: "auto", label: t.plan.autonomyAuto, desc: t.plan.autonomyDescAuto },
  ];
  const autonomy = (wedding.autonomy as Autonomy) || "ask";
  const currentAutonomy = AUTONOMY.find((a) => a.key === autonomy) ?? AUTONOMY[0];

  const setAutonomy = async (value: Autonomy) => {
    if (value === autonomy || autonomyBusy) return;
    setAutonomyBusy(true);
    setAutonomyError(null);
    try {
      const updated = await updateWedding(wedding.id, { autonomy: value });
      setWedding(updated);
      refreshActivity();
    } catch {
      // Without this the toggle just silently refuses to move.
      setAutonomyError(t.plan.autonomyError);
    } finally {
      setAutonomyBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={t.plan.teamTitle}
        subtitle={t.plan.teamSubtitle(teamCount)}
        fallback="/plan"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
          <Avatar letter={initial(ownerName)} tint="accent" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>
              {ownerName}{" "}
              <span style={{ fontWeight: 400, color: T.faint }}>· {t.plan.you}</span>
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{t.plan.ownerSub}</div>
          </div>
          <StatusPill tone="accent">{t.plan.roles.owner}</StatusPill>
        </Card>

        {collaborators === null ? (
          <Loading />
        ) : (
          collaborators.map((c) => {
            const active = c.status === "active";
            const name = c.profile_full_name || c.email;
            const when = timeAgo(active ? c.joined_at : c.invited_at, locale);
            return (
              <Card
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}
              >
                <Avatar letter={initial(name)} tint={active ? "green" : "amber"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14.5,
                      color: T.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                    {active ? t.plan.activeSub(when) : t.plan.pendingSub(when)}
                  </div>
                </div>
                {!active && (
                  <button
                    type="button"
                    onClick={() => cancelInvite(c.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "4px 2px",
                      flexShrink: 0,
                    }}
                  >
                    {t.plan.cancelInvite}
                  </button>
                )}
                <StatusPill tone={active ? "green" : "amber"}>
                  {active ? t.plan.roles.partner : t.plan.roles.pending}
                </StatusPill>
              </Card>
            );
          })
        )}
      </div>

      {/* Invite */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 20,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: "16px 16px 15px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        <div className="u-serif" style={{ fontWeight: 600, fontSize: 19, color: T.ink }}>
          {t.plan.inviteHelper}
        </div>
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 4, lineHeight: 1.45 }}>
          {t.plan.inviteBody}
        </div>
        <form onSubmit={submitInvite} style={{ display: "flex", gap: 9, marginTop: 13 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setInviteError(null);
            }}
            placeholder={t.plan.invitePlaceholder}
            disabled={inviteBusy}
            style={{ flex: 1, minHeight: 44 }}
          />
          <Button type="submit" disabled={inviteBusy} style={{ flexShrink: 0 }}>
            {inviteBusy ? t.plan.inviteSending : t.common.invite}
          </Button>
        </form>
        {inviteError && (
          <div style={{ fontSize: 12.5, color: T.accentInk, marginTop: 8 }}>{inviteError}</div>
        )}
      </div>

      {/* Union as teammate — how much it does on its own */}
      <SectionLabel>{t.plan.unionTeammateKicker}</SectionLabel>
      <div style={{ borderRadius: 22, background: T.surface, border: `1px solid ${T.line}`, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: T.accentSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Spark size={15} color={T.accent} />
          </span>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
            {t.plan.unionTeammateBody}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t.plan.autonomyLabel}
          style={{
            display: "flex",
            gap: 5,
            background: "#F1EDE7",
            borderRadius: 14,
            padding: 4,
            marginTop: 14,
            opacity: autonomyBusy ? 0.6 : 1,
          }}
        >
          {AUTONOMY.map((a) => {
            const on = a.key === autonomy;
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={autonomyBusy}
                onClick={() => setAutonomy(a.key)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  cursor: "pointer",
                  background: on ? "#fff" : "transparent",
                  borderRadius: 11,
                  border: "none",
                  padding: "9px 4px",
                  fontWeight: 600,
                  fontSize: 13,
                  color: on ? T.ink : T.faint,
                  boxShadow: on ? "0 2px 6px rgba(67,53,58,.06)" : "none",
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 12, lineHeight: 1.5 }}>
          {currentAutonomy.desc}
        </div>
        {autonomyError && (
          <div style={{ fontSize: 12.5, color: T.accentInk, marginTop: 8 }}>{autonomyError}</div>
        )}
      </div>

      {/* Activity */}
      <SectionLabel>{t.plan.whoDidWhat}</SectionLabel>
      {activity === null ? (
        <Loading />
      ) : activity.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.faint, padding: "0 4px" }}>
          {t.plan.activityEmpty}
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 26 }}>
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 6,
              bottom: 12,
              width: 2,
              background: "rgba(67,53,58,.08)",
            }}
          />
          {activity.map((a) => (
            <div key={a.id} style={{ position: "relative", paddingBottom: 17 }}>
              <span
                style={{
                  position: "absolute",
                  left: a.actor_kind === "union" ? -25 : -24,
                  top: a.actor_kind === "union" ? 0 : 1,
                  width: a.actor_kind === "union" ? 19 : 17,
                  height: a.actor_kind === "union" ? 19 : 17,
                  borderRadius: "50%",
                  background: a.actor_kind === "union" ? T.accentSoft : T.accentPink,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.serif,
                  fontWeight: 600,
                  fontSize: 10,
                  color: T.accentInk,
                }}
              >
                {a.actor_kind === "union" ? (
                  <Spark size={11} color={T.accent} />
                ) : (
                  a.actor_label.charAt(0)
                )}
              </span>
              <div style={{ fontWeight: 500, fontSize: 14, color: T.ink, lineHeight: 1.4 }}>
                <b style={{ fontWeight: 600 }}>{a.actor_label}</b> {a.action_text}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
                {timeAgo(a.created_at, locale)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
