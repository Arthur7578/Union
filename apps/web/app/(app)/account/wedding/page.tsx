"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { updateWedding, deleteWedding } from "@/lib/data";
import { formatLongDate, initial } from "@/lib/format";
import { useLocale } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, SectionLabel, UnionNote } from "@/components/ui";

export default function WeddingSettingsPage() {
  const router = useRouter();
  const { wedding, setWedding } = useWedding();
  const { locale, t } = useLocale();

  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [guestTarget, setGuestTarget] = useState("");
  const [styleVibe, setStyleVibe] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    setPartnerOne(wedding.partner_one ?? "");
    setPartnerTwo(wedding.partner_two ?? "");
    setEventDate(wedding.event_date ?? "");
    setVenueName(wedding.venue_name ?? "");
    setVenueAddress(wedding.venue_address ?? "");
    setGuestTarget(
      wedding.guest_count_target != null ? String(wedding.guest_count_target) : "",
    );
    setStyleVibe(wedding.style_vibe ?? "");
  }, [wedding]);

  if (!wedding) return null;

  const complete = Boolean(wedding.partner_two && wedding.event_date && wedding.venue_name);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await updateWedding(wedding.id, {
        partner_one: partnerOne.trim() || null,
        partner_two: partnerTwo.trim() || null,
        event_date: eventDate || null,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        guest_count_target: guestTarget.trim() ? parseInt(guestTarget, 10) : null,
        style_vibe: styleVibe.trim() || null,
      });
      setWedding(updated);
      setNote(t.account.saved);
      setTimeout(() => setNote(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const coupleLine =
      [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
      wedding.partner_one ||
      t.account.weddingTitle;
    if (typeof window !== "undefined" && !window.confirm(t.account.deleteConfirm(coupleLine))) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteWedding(wedding.id);
      setWedding(null);
      router.replace("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
      setDeleting(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader title={t.account.weddingTitle} subtitle={t.account.weddingKicker} fallback="/account" />

      <div
        style={{
          borderRadius: 22,
          background: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",
          padding: "20px 18px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Avatar letter={wedding.partner_one ? initial(wedding.partner_one) : "•"} size={44} />
          <div style={{ marginLeft: -12 }}>
            <Avatar
              letter={wedding.partner_two ? initial(wedding.partner_two) : "+"}
              tint="green"
              size={44}
            />
          </div>
        </div>
        <div className="u-serif" style={{ fontWeight: 700, fontSize: 30, color: T.ink, marginTop: 8 }}>
          {wedding.partner_one || "—"} <span style={{ color: T.accentInk }}>&amp;</span>{" "}
          {wedding.partner_two || t.account.partnerNotSet}
        </div>
        <div style={{ fontWeight: 500, fontSize: 13.5, color: T.muted, marginTop: 3 }}>
          {wedding.event_date || wedding.venue_name
            ? [formatLongDate(wedding.event_date, locale), wedding.venue_name]
                .filter(Boolean)
                .join(" · ")
            : t.account.weddingRowFallback}
        </div>
      </div>

      {!complete && (
        <div style={{ marginTop: 14 }}>
          <UnionNote>{t.account.emptyPrompt}</UnionNote>
        </div>
      )}

      <SectionLabel>{t.account.detailsHeading}</SectionLabel>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="p1">{t.onboarding.yourName}</label>
          <input
            id="p1"
            type="text"
            value={partnerOne}
            onChange={(e) => setPartnerOne(e.target.value)}
            placeholder={t.onboarding.yourNamePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="p2">{t.onboarding.partnerName}</label>
          <input
            id="p2"
            type="text"
            value={partnerTwo}
            onChange={(e) => setPartnerTwo(e.target.value)}
            placeholder={t.onboarding.partnerNamePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="dt">{t.account.dateLabel}</label>
          <input id="dt" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vn">{t.account.venueLabel}</label>
          <input
            id="vn"
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder={t.onboarding.venuePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="va">{t.account.venueAddressLabel}</label>
          <input
            id="va"
            type="text"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder={t.account.venueAddressPlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="gc">{t.account.guestTargetLabel}</label>
          <input
            id="gc"
            type="number"
            min={0}
            value={guestTarget}
            onChange={(e) => setGuestTarget(e.target.value)}
            placeholder="120"
          />
        </div>
        <div className="field">
          <label htmlFor="sv">{t.account.styleLabel}</label>
          <input
            id="sv"
            type="text"
            value={styleVibe}
            onChange={(e) => setStyleVibe(e.target.value)}
            placeholder={t.account.stylePlaceholder}
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

      <SectionLabel>{t.account.manageSection}</SectionLabel>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 15px",
          borderRadius: 18,
          background: T.surfaceAlt,
          border: `1px solid ${T.line}`,
          color: "#B0664E",
          fontWeight: 600,
          fontSize: 14.5,
          cursor: "pointer",
        }}
      >
        {deleting ? t.account.deleting : t.account.deleteWedding}
      </button>
    </main>
  );
}
