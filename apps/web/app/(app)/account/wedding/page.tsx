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
  const [addressLine, setAddressLine] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressArea, setAddressArea] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [addressVisibility, setAddressVisibility] = useState<"hidden" | "area" | "partial" | "full">("full");
  const [guestTarget, setGuestTarget] = useState("");
  const [styleVibe, setStyleVibe] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!wedding) return;
    setPartnerOne(wedding.partner_one ?? "");
    setPartnerTwo(wedding.partner_two ?? "");
    setEventDate(wedding.event_date ?? "");
    setVenueName(wedding.venue_name ?? "");
    setAddressLine(wedding.address_line ?? "");
    setAddressPostalCode(wedding.address_postal_code ?? "");
    setAddressCity(wedding.address_city ?? "");
    setAddressArea(wedding.address_area ?? "");
    setAddressCountry(wedding.address_country ?? "");
    setAddressVisibility(wedding.address_visibility);
    setGuestTarget(
      wedding.guest_count_target != null ? String(wedding.guest_count_target) : "",
    );
    setStyleVibe(wedding.style_vibe ?? "");
  }, [wedding]);

  if (!wedding) return null;

  const complete = Boolean(wedding.partner_two && wedding.event_date && wedding.venue_name);
  const coupleLine =
    [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ") ||
    wedding.partner_one ||
    t.account.weddingTitle;
  const confirmPhrase = t.account.deletePhrase(wedding.partner_one || t.account.partnerNotSet);

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
        address_line: addressLine.trim() || null,
        address_postal_code: addressPostalCode.trim() || null,
        address_city: addressCity.trim() || null,
        address_area: addressArea.trim() || null,
        address_country: addressCountry.trim() || null,
        address_visibility: addressVisibility,
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

  const openConfirm = () => {
    setConfirmInput("");
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
  };

  const canConfirm =
    confirmInput.trim().toLowerCase() === confirmPhrase.trim().toLowerCase();

  const remove = async () => {
    if (!canConfirm) {
      setConfirmError(t.account.deleteConfirmMismatch);
      return;
    }
    setDeleting(true);
    setConfirmError(null);
    try {
      await deleteWedding(wedding.id);
      setWedding(null);
      router.replace("/onboarding");
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : t.common.error);
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
          <label htmlFor="al">{t.account.addressLineLabel}</label>
          <input
            id="al"
            type="text"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder={t.account.addressLinePlaceholder}
          />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="apc">{t.account.addressPostalCodeLabel}</label>
            <input
              id="apc"
              type="text"
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              placeholder={t.account.addressPostalCodePlaceholder}
            />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="ac">{t.account.addressCityLabel}</label>
            <input
              id="ac"
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder={t.account.addressCityPlaceholder}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="aa">{t.account.addressAreaLabel}</label>
          <input
            id="aa"
            type="text"
            value={addressArea}
            onChange={(e) => setAddressArea(e.target.value)}
            placeholder={t.account.addressAreaPlaceholder}
          />
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
            {t.account.addressAreaHint}
          </div>
        </div>
        <div className="field">
          <label htmlFor="acy">{t.account.addressCountryLabel}</label>
          <input
            id="acy"
            type="text"
            value={addressCountry}
            onChange={(e) => setAddressCountry(e.target.value)}
            placeholder={t.account.addressCountryPlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="avis">{t.account.addressVisibilityLabel}</label>
          <select
            id="avis"
            value={addressVisibility}
            onChange={(e) =>
              setAddressVisibility(e.target.value as "hidden" | "area" | "partial" | "full")
            }
          >
            <option value="hidden">{t.account.addressVisibilityHidden}</option>
            <option value="area">{t.account.addressVisibilityArea}</option>
            <option value="partial">{t.account.addressVisibilityPartial}</option>
            <option value="full">{t.account.addressVisibilityFull}</option>
          </select>
          <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
            {t.account.addressVisibilityHint}
          </div>
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
        onClick={openConfirm}
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
        {t.account.deleteWedding}
      </button>

      {confirmOpen && (
        <DeleteConfirmModal
          coupleLine={coupleLine}
          phrase={confirmPhrase}
          value={confirmInput}
          onChange={(v) => {
            setConfirmInput(v);
            if (confirmError) setConfirmError(null);
          }}
          canConfirm={canConfirm}
          deleting={deleting}
          error={confirmError}
          onCancel={closeConfirm}
          onConfirm={remove}
          t={t}
        />
      )}
    </main>
  );
}

function DeleteConfirmModal({
  coupleLine,
  phrase,
  value,
  onChange,
  canConfirm,
  deleting,
  error,
  onCancel,
  onConfirm,
  t,
}: {
  coupleLine: string;
  phrase: string;
  value: string;
  onChange: (v: string) => void;
  canConfirm: boolean;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-title"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,22,25,.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          borderRadius: 22,
          border: `1px solid ${T.line}`,
          padding: 22,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 30px 60px rgba(30,22,25,.28)",
        }}
      >
        <div
          id="del-title"
          className="u-serif"
          style={{ fontWeight: 700, fontSize: 24, color: T.ink, lineHeight: 1.15 }}
        >
          {t.account.deleteConfirmTitle}
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
          {t.account.deleteConfirmBody(coupleLine)}
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="del-phrase" style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>
            {t.account.deleteConfirmPrompt}
          </label>
          <div
            style={{
              fontFamily: T.serif,
              fontWeight: 600,
              fontSize: 15,
              color: T.accentInk,
              background: T.accentSoft,
              border: `1px solid ${T.accentBorder}`,
              borderRadius: 12,
              padding: "10px 12px",
              marginBottom: 10,
              userSelect: "none",
            }}
          >
            {phrase}
          </div>
          <input
            id="del-phrase"
            type="text"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={phrase}
          />
        </div>
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={deleting}
            style={{ flex: 1 }}
          >
            {t.common.cancel}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || deleting}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 14,
              border: "none",
              background: canConfirm ? "#B0664E" : "rgba(176,102,78,.35)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: canConfirm && !deleting ? "pointer" : "default",
              boxShadow: canConfirm ? "0 6px 16px rgba(176,102,78,.24)" : "none",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? t.account.deleting : t.account.deleteConfirmAction}
          </button>
        </div>
      </div>
    </div>
  );
}
