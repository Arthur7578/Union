"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Profile } from "@union/shared";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { useWedding } from "@/lib/wedding";
import { updateProfile } from "@/lib/data";
import { initial } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { PhoneField } from "@/components/PhoneField";
import { Avatar, Button, SectionLabel, Loading } from "@/components/ui";

export default function EditProfilePage() {
  const t = useT();
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <main className="u-main">
        <Loading label={t.common.oneMoment} />
      </main>
    );
  }
  if (!profile) return null;

  return <EditProfileForm key={profile.id} profile={profile} />;
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const t = useT();
  const { session } = useAuth();
  const { setProfile } = useProfile();
  const { wedding } = useWedding();

  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const email = session?.user?.email ?? "";
  const displayName =
    wedding?.partner_one?.trim() ||
    profile.full_name?.trim() ||
    email.split("@")[0] ||
    t.account.title;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateProfile(profile.id, {
        phone: phone.trim() || null,
      });
      setProfile(updated);
      setNote(t.account.saved);
      setTimeout(() => setNote(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader title={t.account.profileTitle} subtitle={t.account.profileSubtitle} fallback="/account" />

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <Avatar letter={initial(displayName)} size={82} />
      </div>

      <SectionLabel style={{ marginTop: 0 }}>{t.account.detailsSection}</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label>{t.account.nameLabel}</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              border: `1px solid ${T.line3}`,
              borderRadius: 12,
              background: T.surfaceAlt,
              color: T.muted,
              minHeight: 48,
            }}
          >
            <span style={{ flex: 1, fontWeight: 500, fontSize: 15, color: T.ink2 }}>
              {displayName}
            </span>
            <Link
              href="/account/wedding"
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: T.accentInk,
                textDecoration: "none",
              }}
            >
              {t.account.editOnWedding}
            </Link>
          </div>
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
            {t.account.nameEditsOnWedding}
          </div>
        </div>

        <div className="field">
          <label htmlFor="em">{t.account.email}</label>
          <input id="em" type="email" value={email} readOnly style={{ background: T.surfaceAlt, color: T.muted }} />
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>{t.account.emailNote}</div>
        </div>

        <div className="field">
          <label htmlFor="ph">{t.account.phone}</label>
          <PhoneField id="ph" value={phone} onChange={setPhone} />
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
            {t.account.phoneHint}
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <Button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? t.common.saving : t.common.save}
        </Button>
        {note && (
          <div style={{ textAlign: "center", fontSize: 13, color: T.greenInk, marginTop: 10 }}>
            {note}
          </div>
        )}
      </form>
    </main>
  );
}
