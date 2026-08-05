"use client";

import React, { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  readActiveGuestIdentity,
  readStoredActiveGuestIdentity,
  writeActiveGuestIdentity,
  type ActiveGuestIdentity,
} from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";

type GateState = "checking" | "confirm" | "allowed";

export function GuestIdentityGate({
  guestId,
  guestName,
  children,
}: {
  guestId: string;
  guestName: string;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();
  const [state, setState] = useState<GateState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeGuest, setActiveGuest] =
    useState<ActiveGuestIdentity | null>(null);

  useEffect(() => {
    let mounted = true;

    void getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const currentUserId = data.session?.user.id ?? null;
        const stored = currentUserId
          ? readActiveGuestIdentity(currentUserId)
          : readStoredActiveGuestIdentity();

        if (!currentUserId && !stored) {
          // A dedicated invitation token remains a bearer credential for
          // guests who have not opted into an Auth account yet.
          setState("allowed");
          return;
        }

        setUserId(currentUserId);
        setActiveGuest(stored);
        setState(stored?.guestId === guestId ? "allowed" : "confirm");
      });

    return () => {
      mounted = false;
    };
  }, [guestId]);

  if (state === "allowed") return <>{children}</>;

  const isFrench = locale === "fr";
  const switching = !!activeGuest;

  const confirm = () => {
    const identityUserId = userId ?? activeGuest?.userId;
    if (identityUserId) {
      writeActiveGuestIdentity({
        userId: identityUserId,
        guestId,
        guestName,
      });
    }
    setState("allowed");
  };

  return (
    <main style={pageStyle}>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LanguageSwitcher />
      </div>
      <section style={cardStyle}>
        <div style={kickerStyle}>
          {isFrench ? "Identité d’invité" : "Guest identity"}
        </div>
        {state === "checking" ? (
          <p style={bodyStyle}>
            {isFrench
              ? "Vérification de l’invitation…"
              : "Checking the invitation…"}
          </p>
        ) : (
          <>
            <h1 style={titleStyle}>
              {switching
                ? isFrench
                  ? "Changer d’invitation ?"
                  : "Switch invitations?"
                : isFrench
                  ? "Ouvrir cette invitation ?"
                  : "Open this invitation?"}
            </h1>
            <p style={bodyStyle}>
              {switching
                ? isFrench
                  ? `Vous utilisez actuellement l’invitation de ${activeGuest.guestName}. Ce lien privé est destiné à ${guestName}.`
                  : `You are currently using ${activeGuest.guestName}’s invitation. This private link is for ${guestName}.`
                : isFrench
                  ? `Ce lien privé est destiné à ${guestName}. Confirmez avant de continuer.`
                  : `This private link is for ${guestName}. Confirm before continuing.`}
            </p>
            <button type="button" onClick={confirm} style={primaryButtonStyle}>
              {isFrench
                ? `Continuer en tant que ${guestName}`
                : `Continue as ${guestName}`}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={textButtonStyle}
            >
              {isFrench ? "Annuler" : "Cancel"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f1ea",
  padding: "80px 20px 32px",
  color: "#2b2724",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 18px 55px rgba(43, 39, 36, 0.08)",
  padding: "38px 32px",
  boxSizing: "border-box",
  textAlign: "center",
};

const kickerStyle: React.CSSProperties = {
  color: "#9a7d66",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 32,
  lineHeight: 1.15,
  margin: "0 0 12px",
  fontWeight: 600,
};

const bodyStyle: React.CSSProperties = {
  color: "#756b65",
  fontSize: 15,
  lineHeight: 1.55,
  margin: "0 0 22px",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: 0,
  borderRadius: 999,
  background: "#2b2724",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 20px",
};

const textButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#6f655f",
  fontSize: 14,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 8,
  marginTop: 12,
};
