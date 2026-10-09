"use client";

import React, { useEffect, useState } from "react";
import { DaRoot } from "@/components/guest/DaRoot";
import { Flow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices } from "@/components/guest/flow/fields";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { OliveBranch } from "@/components/guest/OliveBranch";
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
  const [choice, setChoice] = useState<"continue" | "cancel" | null>(null);

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

  const step: FlowStep =
    state === "checking"
      ? {
          key: "checking",
          kind: "intro",
          before: <OliveBranch className="tf-ornament" />,
          title: isFrench ? "Un instant…" : "One moment…",
          description: isFrench ? "Vérification de l’invitation…" : "Checking the invitation…",
          hideOk: true,
        }
      : {
          key: "confirm",
          kind: "intro",
          before: <OliveBranch className="tf-ornament" />,
          title: switching
            ? isFrench
              ? "Changer d’invitation ?"
              : "Switch invitations?"
            : isFrench
              ? "Ouvrir cette invitation ?"
              : "Open this invitation?",
          description: switching
            ? isFrench
              ? `Vous utilisez actuellement l’invitation de ${activeGuest.guestName}. Ce lien privé est destiné à ${guestName}.`
              : `You are currently using ${activeGuest.guestName}’s invitation. This private link is for ${guestName}.`
            : isFrench
              ? `Ce lien privé est destiné à ${guestName}. Confirmez avant de continuer.`
              : `This private link is for ${guestName}. Confirm before continuing.`,
          body: (
            <div className="tf-choices-center">
              <FlowChoices
                options={[
                  {
                    id: "continue",
                    label: isFrench ? `Continuer en tant que ${guestName}` : `Continue as ${guestName}`,
                  },
                  { id: "cancel", label: isFrench ? "Annuler" : "Cancel" },
                ]}
                value={choice}
                onChange={(id) => setChoice(id as "continue" | "cancel")}
              />
            </div>
          ),
          valid: choice !== null,
          hideOk: true,
          onNext: () => {
            if (choice === "cancel") {
              setChoice(null);
              window.history.back();
            } else {
              confirm();
            }
            return false;
          },
        };

  return (
    <DaRoot>
      <Flow
        label={isFrench ? "Identité d’invité" : "Guest identity"}
        steps={[step]}
        topRight={<LocaleToggle />}
      />
    </DaRoot>
  );
}
