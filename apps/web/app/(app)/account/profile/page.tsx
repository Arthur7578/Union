"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { updateProfile } from "@/lib/data";
import { initial } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, SectionLabel, Loading } from "@/components/ui";

export default function EditProfilePage() {
  const t = useT();
  const { session } = useAuth();
  const { profile, loading, setProfile } = useProfile();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  if (loading) {
    return (
      <main className="u-main">
        <Loading label={t.common.oneMoment} />
      </main>
    );
  }
  if (!profile) return null;

  const email = session?.user?.email ?? "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateProfile(profile.id, {
        full_name: fullName.trim() || null,
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
        <Avatar letter={initial(fullName || email)} size={82} />
      </div>

      <SectionLabel style={{ marginTop: 0 }}>{t.account.detailsSection}</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="fn">{t.account.fullName}</label>
          <input
            id="fn"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.onboarding.yourNamePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="em">{t.account.email}</label>
          <input id="em" type="email" value={email} readOnly style={{ background: T.surfaceAlt, color: T.muted }} />
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>{t.account.emailNote}</div>
        </div>
        <div className="field">
          <label htmlFor="ph">{t.account.phone}</label>
          <input
            id="ph"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.guests.placeholders.phone}
          />
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
