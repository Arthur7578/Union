"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupabase } from "@/lib/supabase";
import type { JoinWeddingPreview } from "./page";

type Step = "name" | "confirm" | "contact" | "not_found" | "redirecting";

type MatchResult = {
  token: string;
  first_name: string;
  last_name: string | null;
};

interface FindGuestResult {
  status: "match" | "ambiguous" | "not_found" | "invalid_link";
  token?: string;
  first_name?: string;
  last_name?: string | null;
}

export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t, locale } = useLocale();

  const [step, setStep] = useState<Step>("name");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partners =
    [preview.partner_one, preview.partner_two].filter(Boolean).join(" & ") ||
    (locale === "fr" ? "les mariés" : "the couple");

  const displayDate = preview.event_date
    ? new Date(`${preview.event_date}T00:00:00`).toLocaleDateString(
        locale === "fr" ? "fr-FR" : "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
      )
    : null;

  const runSearch = async (withContact?: string) => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "find_guest_by_name",
        {
          p_join_code: code,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim() || undefined,
          p_contact: withContact?.trim() || undefined,
        },
      );
      if (rpcError) throw rpcError;
      const result = data as unknown as FindGuestResult;

      if (result.status === "match") {
        setMatch({
          token: result.token!,
          first_name: result.first_name!,
          last_name: result.last_name ?? null,
        });
        setStep("confirm");
      } else if (result.status === "ambiguous") {
        setStep("contact");
      } else {
        setStep("not_found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.join.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    void runSearch();
  };

  const submitContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;
    void runSearch(contact);
  };

  const confirmYes = () => {
    if (!match) return;
    setStep("redirecting");
    window.location.href = `/guest/${match.token}`;
  };

  const startOver = () => {
    setMatch(null);
    setContact("");
    setError(null);
    setStep("name");
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 460,
    width: "100%",
    background: "white",
    padding: "40px 32px",
    borderRadius: 24,
    boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #e1dec3",
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 15,
    background: "#fbfbf8",
    color: "#2b2724",
    marginBottom: 14,
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: 16,
    background: "#43353a",
    color: "white",
    border: "none",
    borderRadius: 14,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f1ea",
        fontFamily: "'Instrument Sans', sans-serif",
        padding: 24,
        color: "#2b2724",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Instrument+Sans:wght@300;400;600;700&display=swap');`,
        }}
      />
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <LanguageSwitcher compact />
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#b07c82",
            fontWeight: 600,
          }}
        >
          {t.join.heroKicker}
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 44,
            fontWeight: 300,
            letterSpacing: -1,
            margin: "4px 0 8px",
          }}
        >
          {partners}
        </h1>
        {displayDate && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              color: "#8a817c",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {displayDate}
            {preview.venue_name ? ` • ${preview.venue_name}` : ""}
          </p>
        )}
      </div>

      <div style={cardStyle}>
        {step === "name" && (
          <form onSubmit={submitName}>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 6,
              }}
            >
              {t.join.namePromptTitle}
            </h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.join.namePromptSubtitle}
            </p>
            <label
              htmlFor="join-first-name"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {t.join.firstNameLabel}
            </label>
            <input
              id="join-first-name"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={fieldStyle}
            />
            <label
              htmlFor="join-last-name"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {t.join.lastNameLabel}
            </label>
            <input
              id="join-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !firstName.trim()}
              style={{
                ...buttonStyle,
                opacity: busy || !firstName.trim() ? 0.6 : 1,
                cursor: busy || !firstName.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.join.searching : t.join.continueButton}
            </button>
          </form>
        )}

        {step === "confirm" && match && (
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 6,
              }}
            >
              {t.join.confirmTitle}
            </h2>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 600,
                color: "#b07c82",
                margin: "8px 0 24px",
              }}
            >
              {match.first_name} {match.last_name ?? ""}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={startOver}
                style={{
                  flex: 1,
                  padding: 16,
                  background: "#fbfbf8",
                  color: "#43353a",
                  border: "1px solid #e1dec3",
                  borderRadius: 14,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {t.join.noButton}
              </button>
              <button
                type="button"
                onClick={confirmYes}
                style={{ ...buttonStyle, flex: 1 }}
              >
                {t.join.yesButton}
              </button>
            </div>
          </div>
        )}

        {step === "contact" && (
          <form onSubmit={submitContact}>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 6,
              }}
            >
              {t.join.contactTitle}
            </h2>
            <p style={{ color: "#8a817c", fontSize: 14, marginBottom: 20 }}>
              {t.join.contactSubtitle}
            </p>
            <label
              htmlFor="join-contact"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {t.join.contactLabel}
            </label>
            <input
              id="join-contact"
              autoFocus
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t.join.contactPlaceholder}
              style={{ ...fieldStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ color: "#b0524f", fontSize: 13, marginBottom: 14 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !contact.trim()}
              style={{
                ...buttonStyle,
                opacity: busy || !contact.trim() ? 0.6 : 1,
                cursor: busy || !contact.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t.join.searching : t.join.contactSubmit}
            </button>
          </form>
        )}

        {step === "not_found" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 10,
              }}
            >
              {t.join.notFoundTitle}
            </h2>
            <p
              style={{
                color: "#8a817c",
                fontSize: 14,
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {t.join.notFoundBody(partners)}
            </p>
            <button type="button" onClick={startOver} style={buttonStyle}>
              {t.join.tryAgainButton}
            </button>
          </div>
        )}

        {step === "redirecting" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ color: "#8a817c", fontSize: 14 }}>
              {t.join.redirecting}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
