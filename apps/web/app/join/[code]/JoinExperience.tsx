"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { guestLinkPath } from "@union/shared";
import { DaRoot } from "@/components/guest/DaRoot";
import { Flow, useFlow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowText } from "@/components/guest/flow/fields";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { CountrySelect, useBrowserCountry } from "@/components/PhoneField";
import { LAST_EMAIL_KEY, sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { writeActiveGuestIdentity } from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useTurnstile } from "@/lib/turnstile";
import type { JoinWeddingPreview } from "./page";
import { isPhoneCountry, toStoredPhone, type PhoneCountry } from "@union/shared";

/** The screens of the form; each step answers which one comes next. */
type View = "contact" | "first_name" | "email_code" | "no_match" | "redirecting";

type DisambiguationSource = "contact" | "authenticated" | null;

interface ContactLookupResult {
  status:
    | "match"
    | "ambiguous"
    | "otp_required"
    | "email_required"
    | "not_found"
    | "invalid_link";
  token?: string;
}

interface GuestAccessOption {
  guest_id: string;
  first_name: string;
  last_name: string | null;
}

interface GuestAccessOptionsResult {
  status: "ok" | "not_authenticated";
  matches?: GuestAccessOption[];
}

interface ClaimGuestAccessResult {
  status:
    | "verified"
    | "not_authenticated"
    | "not_found"
    | "already_claimed"
    | "not_available";
  token?: string;
}

/** An error worded for the guest: shown as is, never replaced by a generic one. */
class GuestFacingError extends Error {}

function readLastEmail(): string {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

// The country picker keeps its native <select>; only its look follows the
// underlined answers around it.
const COUNTRY_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 0,
  marginTop: 18,
  padding: "8px 0",
  border: 0,
  borderBottom: "1px solid var(--da-sage)",
  borderRadius: 0,
  background: "transparent",
  color: "var(--da-ink)",
  font: "inherit",
  fontSize: 18,
};

/** "Use another email or phone number": back to the first question. */
function StartOver({ onStartOver }: { onStartOver: () => void }) {
  const { t } = useLocale();
  const flow = useFlow();
  return (
    <button
      type="button"
      className="tf-link"
      onClick={() => {
        onStartOver();
        flow.goTo("contact");
      }}
    >
      {t.guestJoin.useAnotherContact}
    </button>
  );
}

/** "Resend code", with its own busy state and error, without leaving the step. */
function Resend({ onResend }: { onResend: () => Promise<unknown> }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        className="tf-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await onResend();
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t.guestJoin.resendButton}
      </button>
      {failed ? (
        <p className="tf-error" role="alert">
          {t.guestJoin.sendCodeError}
        </p>
      ) : null}
    </>
  );
}

/**
 * The group link (/join/[code]): a guest finds their own invitation by the
 * e-mail or phone the couple has for them, then their first name or a
 * one-time code if needed — asked one question at a time, like every guest
 * form. Which question comes next is the server's answer to the last one.
 */
export function JoinExperience({
  code,
  preview,
}: {
  code: string;
  preview: JoinWeddingPreview;
}) {
  const { t } = useLocale();
  const copy = t.guestJoin;
  const router = useRouter();
  const otpMode = preview.guest_join_auth_mode === "otp";
  // Where the form opens, once the session check has answered.
  const [start, setStart] = useState<View | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [contact, setContact] = useState(() => (otpMode ? readLastEmail() : ""));
  const [email, setEmail] = useState(() => (otpMode ? readLastEmail() : ""));
  const [codeSent, setCodeSent] = useState(false);
  // The country of a phone number typed without "+"; see phoneMode below.
  // Until the guest chooses, the browser's country is shown for them to
  // confirm or change.
  const browserCountry = useBrowserCountry();
  const [pickedCountry, setPickedCountry] = useState<PhoneCountry | null | undefined>(undefined);
  const contactCountry = pickedCountry !== undefined ? pickedCountry : browserCountry;
  const [firstName, setFirstName] = useState("");
  const [otp, setOtp] = useState("");
  const [disambiguationSource, setDisambiguationSource] = useState<DisambiguationSource>(null);
  const { captcha, getCaptchaToken } = useTurnstile();

  const partners = [preview.partner_one, preview.partner_two].filter(Boolean).join(" & ") || t.guests.theCouple;

  const redirectToGuest = useCallback(
    (token: string): View => {
      // They have just read the invitation, so their own link needn't repeat
      // it. Best-effort: failing to record it only means seeing it again.
      void getBrowserSupabase()
        .rpc("mark_welcome_seen", { p_token: token })
        .then(undefined, () => {})
        .then(() => router.push(guestLinkPath(token)));
      return "redirecting";
    },
    [router],
  );

  const claimAndContinue = useCallback(
    async (match: GuestAccessOption): Promise<View> => {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("claim_guest_access", { p_guest_id: match.guest_id });
      if (rpcError) throw new GuestFacingError(t.guestJoin.genericError);

      const result = data as unknown as ClaimGuestAccessResult;
      if (result.status !== "verified" || !result.token) {
        throw new GuestFacingError(t.guestJoin.accessUnavailable);
      }

      const { data: authData } = await supabase.auth.getSession();
      if (authData.session) {
        writeActiveGuestIdentity({
          userId: authData.session.user.id,
          guestId: match.guest_id,
          guestName: [match.first_name, match.last_name].filter(Boolean).join(" "),
        });
      }
      return redirectToGuest(result.token);
    },
    [redirectToGuest, t],
  );

  /** For a signed-in guest: their invitations on this wedding, by first name if given. */
  const loadAuthenticatedOptions = useCallback(
    async (name?: string): Promise<View> => {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("get_guest_access_options", {
        p_join_code: code,
        p_first_name: name?.trim() || null,
      });
      if (rpcError) throw rpcError;

      const result = data as unknown as GuestAccessOptionsResult;
      const found = result.matches ?? [];
      if (result.status !== "ok" || found.length === 0) return "no_match";
      if (found.length > 1) {
        if (name) return "no_match";
        setDisambiguationSource("authenticated");
        return "first_name";
      }
      return claimAndContinue(found[0]);
    },
    [claimAndContinue, code],
  );

  useEffect(() => {
    let active = true;

    void getBrowserSupabase()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!active) return;
        if (!data.session) {
          setStart("contact");
          return;
        }
        try {
          const view = await loadAuthenticatedOptions();
          if (active) setStart(view);
        } catch (reason) {
          if (!active) return;
          if (reason instanceof GuestFacingError) setStartError(reason.message);
          setStart("contact");
        }
      });

    return () => {
      active = false;
    };
  }, [loadAuthenticatedOptions, otpMode]);

  const requestEmailCode = async (address = email): Promise<View> => {
    const cleanEmail = address.trim();
    try {
      setEmail(cleanEmail);
      await sendEmailOtp(cleanEmail, await getCaptchaToken());
    } catch {
      throw new GuestFacingError(copy.sendCodeError);
    }
    setOtp("");
    setCodeSent(true);
    return "email_code";
  };

  // The guest types an email or a phone in one field. A number only means
  // something with its country, so while they are typing one without a "+"
  // (or 00) we ask for it, and the lookup always sends a number that states
  // its country (E.164). Pre-selecting the browser's country only gives them
  // something visible to confirm.
  const looksLikePhone = !otpMode && /\d/.test(contact) && !contact.includes("@");
  const phoneMode = looksLikePhone && !/^\s*(\+|00)/.test(contact);

  const resolveContact = async (name?: string): Promise<View> => {
    const cleanContact = contact.trim();
    if (phoneMode && !contactCountry) throw new GuestFacingError(t.common.phoneCountryMissing);
    const lookup = looksLikePhone ? toStoredPhone(contactCountry, cleanContact) : cleanContact;

    let result: ContactLookupResult;
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("find_guest_by_contact", {
        p_join_code: code,
        p_contact: lookup,
        p_first_name: name?.trim() || null,
      });
      if (rpcError) throw rpcError;
      result = data as unknown as ContactLookupResult;
    } catch {
      throw new GuestFacingError(copy.genericError);
    }

    if (result.status === "match" && result.token) return redirectToGuest(result.token);
    if (result.status === "ambiguous" && !name) {
      setDisambiguationSource("contact");
      return "first_name";
    }
    if (result.status === "otp_required") return requestEmailCode(cleanContact);
    if (result.status === "email_required") throw new GuestFacingError(copy.emailRequired);
    return "no_match";
  };

  const startOver = () => {
    setFirstName("");
    setOtp("");
    setEmail("");
    setCodeSent(false);
    setDisambiguationSource(null);
    setStartError(null);
  };

  const withCaptcha = (body: React.ReactNode) => (
    <>
      {body}
      {/* Every step that can send a code (first send, resend) renders the
          challenge; it stays empty unless one needs a click. */}
      {captcha ? <div className="tf-captcha">{captcha}</div> : null}
    </>
  );

  const steps: FlowStep[] = [
    {
      key: "contact",
      title: copy.title,
      description: otpMode ? copy.otpSubtitle : copy.contactSubtitle,
      body: withCaptcha(
        <>
          <FlowText
            type={otpMode ? "email" : "text"}
            value={contact}
            onChange={setContact}
            placeholder={otpMode ? copy.emailPlaceholder : copy.contactPlaceholder}
            label={otpMode ? copy.emailLabel : copy.contactLabel}
            autoComplete={otpMode ? "email" : "username"}
          />
          {phoneMode && (
            <CountrySelect
              value={contactCountry}
              onChange={(c) => setPickedCountry(isPhoneCountry(c) ? c : null)}
              style={COUNTRY_STYLE}
            />
          )}
          {startError ? (
            <p className="tf-error" role="alert">
              {startError}
            </p>
          ) : null}
          <p className="tf-note">{otpMode ? copy.otpSecurityNote : copy.contactSecurityNote}</p>
        </>,
      ),
      valid: contact.trim() !== "",
      okLabel: copy.continueButton,
      busyLabel: copy.searching,
      onNext: () => {
        setStartError(null);
        return resolveContact();
      },
    },
  ];

  if (disambiguationSource) {
    steps.push({
      key: "first_name",
      title: copy.firstNameTitle,
      description: copy.firstNameSubtitle,
      body: withCaptcha(
        <>
          <FlowText
            value={firstName}
            onChange={setFirstName}
            placeholder={copy.firstNameLabel}
            label={copy.firstNameLabel}
            autoComplete="given-name"
          />
          <div className="tf-links">
            <StartOver onStartOver={startOver} />
          </div>
        </>,
      ),
      valid: firstName.trim() !== "",
      okLabel: copy.continueButton,
      busyLabel: copy.searching,
      onNext: async () => {
        if (disambiguationSource !== "authenticated") return resolveContact(firstName);
        try {
          return await loadAuthenticatedOptions(firstName);
        } catch (reason) {
          throw reason instanceof GuestFacingError ? reason : new GuestFacingError(copy.genericError);
        }
      },
    });
  }

  if (codeSent) {
    steps.push({
      key: "email_code",
      title: copy.codeTitle,
      description: copy.codeSent(email),
      body: withCaptcha(
        <>
          <FlowText
            value={otp}
            onChange={setOtp}
            placeholder={copy.codePlaceholder}
            label={copy.codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="tf-code"
          />
          <div className="tf-links">
            <Resend onResend={() => requestEmailCode()} />
            <StartOver onStartOver={startOver} />
          </div>
        </>,
      ),
      valid: otp.trim() !== "",
      okLabel: copy.verifyButton,
      busyLabel: copy.verifying,
      onNext: async () => {
        try {
          await verifyEmailOtp(email, otp);
          return await loadAuthenticatedOptions(firstName || undefined);
        } catch (reason) {
          throw reason instanceof GuestFacingError ? reason : new GuestFacingError(copy.invalidCode);
        }
      },
    });
  }

  steps.push(
    {
      key: "no_match",
      kind: "end",
      before: <OliveBranch className="tf-ornament" />,
      title: copy.noMatchTitle,
      description: copy.noMatchBody(partners),
      okLabel: copy.tryAgainButton,
      onNext: () => {
        startOver();
        return "contact";
      },
    },
    {
      key: "redirecting",
      kind: "end",
      before: <OliveBranch className="tf-ornament" />,
      title: copy.redirecting,
      hideOk: true,
    },
  );

  return (
    <DaRoot>
      {start ? (
        <Flow key="join" label={partners} steps={steps} initialKey={start} topRight={<LocaleToggle />} />
      ) : (
        <Flow
          key="checking"
          label={partners}
          topRight={<LocaleToggle />}
          steps={[
            {
              key: "checking",
              kind: "intro",
              before: <OliveBranch className="tf-ornament" />,
              title: copy.checkingSession,
              hideOk: true,
            },
          ]}
        />
      )}
    </DaRoot>
  );
}
