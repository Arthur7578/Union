"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { useWedding } from "@/lib/wedding";
import { updateProfile } from "@/lib/data";
import { initial } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, SectionLabel, Loading } from "@/components/ui";

type Country = { code: string; dial: string; label: string };

const COUNTRIES: Country[] = [
  { code: "US", dial: "+1", label: "United States" },
  { code: "CA", dial: "+1", label: "Canada" },
  { code: "GB", dial: "+44", label: "United Kingdom" },
  { code: "FR", dial: "+33", label: "France" },
  { code: "DE", dial: "+49", label: "Germany" },
  { code: "ES", dial: "+34", label: "Spain" },
  { code: "IT", dial: "+39", label: "Italy" },
  { code: "PT", dial: "+351", label: "Portugal" },
  { code: "NL", dial: "+31", label: "Netherlands" },
  { code: "BE", dial: "+32", label: "Belgium" },
  { code: "CH", dial: "+41", label: "Switzerland" },
  { code: "IE", dial: "+353", label: "Ireland" },
  { code: "SE", dial: "+46", label: "Sweden" },
  { code: "NO", dial: "+47", label: "Norway" },
  { code: "DK", dial: "+45", label: "Denmark" },
  { code: "AU", dial: "+61", label: "Australia" },
  { code: "NZ", dial: "+64", label: "New Zealand" },
  { code: "JP", dial: "+81", label: "Japan" },
  { code: "IN", dial: "+91", label: "India" },
  { code: "BR", dial: "+55", label: "Brazil" },
  { code: "MX", dial: "+52", label: "Mexico" },
  { code: "AR", dial: "+54", label: "Argentina" },
  { code: "ZA", dial: "+27", label: "South Africa" },
  { code: "AE", dial: "+971", label: "United Arab Emirates" },
  { code: "SG", dial: "+65", label: "Singapore" },
  { code: "HK", dial: "+852", label: "Hong Kong" },
];

const DIAL_CODES = Array.from(new Set(COUNTRIES.map((c) => c.dial))).sort(
  (a, b) => b.length - a.length,
);

/** Split a stored E.164-ish number into (dial, local). Longest prefix wins. */
function splitPhone(stored: string, fallbackDial: string): { dial: string; local: string } {
  const clean = stored.replace(/\s+/g, "");
  if (!clean) return { dial: fallbackDial, local: "" };
  if (clean.startsWith("+")) {
    for (const d of DIAL_CODES) {
      if (clean.startsWith(d)) return { dial: d, local: clean.slice(d.length) };
    }
    return { dial: fallbackDial, local: clean.replace(/^\+/, "") };
  }
  return { dial: fallbackDial, local: clean };
}

/** Guess a default country from the browser locale, falling back to US. */
function guessDefaultDial(): string {
  if (typeof navigator === "undefined") return "+1";
  const lang = navigator.language?.toUpperCase() ?? "";
  const region = lang.split("-")[1];
  const hit = region ? COUNTRIES.find((c) => c.code === region) : undefined;
  return hit?.dial ?? "+1";
}

export default function EditProfilePage() {
  const t = useT();
  const { session } = useAuth();
  const { profile, loading, setProfile } = useProfile();
  const { wedding } = useWedding();

  const defaultDial = useMemo(() => guessDefaultDial(), []);
  const [dial, setDial] = useState(defaultDial);
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const parts = splitPhone(profile.phone ?? "", defaultDial);
    setDial(parts.dial);
    setLocal(parts.local);
  }, [profile, defaultDial]);

  if (loading) {
    return (
      <main className="u-main">
        <Loading label={t.common.oneMoment} />
      </main>
    );
  }
  if (!profile) return null;

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
      const digits = local.replace(/[^\d]/g, "");
      const phone = digits ? `${dial}${digits}` : null;
      const updated = await updateProfile(profile.id, { phone });
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
          <div style={{ display: "flex", gap: 8 }}>
            <select
              aria-label={t.account.phoneCountry}
              value={dial}
              onChange={(e) => setDial(e.target.value)}
              style={{ flex: "0 0 128px", paddingRight: 30 }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.dial}>
                  {c.label} ({c.dial})
                </option>
              ))}
            </select>
            <input
              id="ph"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder={t.account.phoneLocalPlaceholder}
              style={{ flex: 1 }}
            />
          </div>
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
