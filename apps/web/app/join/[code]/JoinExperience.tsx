"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { guestLinkPath } from "@union/shared";
import { DaRoot } from "@/components/guest/DaRoot";
import { Flow, useFlow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowText } from "@/components/guest/flow/fields";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { looksLikeEmail } from "@/lib/emailSuggest";
import { markGroupLinkArrival } from "@/lib/groupLinkArrival";
import { markRsvpHandoff } from "@/lib/rsvpHandoff";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useTurnstile } from "@/lib/turnstile";
import type { JoinWeddingPreview } from "./page";

/**
 * The group link, after the welcome: a guest finds their own invitation by
 * name. Their first name, then their last name only when several guests
 * share that first name. In secure mode they then confirm an email with a
 * code (the one the couple entered, or their own, which then secures the
 * invitation); in light mode the name alone opens it.
 *
 * Everyone starts at the name, even on a device already signed in: it may be
 * someone else's (a shared computer, a family tablet). When the account
 * signed in here already holds the invitation for that name, the code step
 * is skipped.
 *
 * Asked one question at a time, like every guest form: each step answers
 * which one comes next, from the server's reply to it.
 */

type View =
  | "name"
  | "last_name"
  | "email"
  | "code"
  | "not_found"
  | "ambiguous"
  | "already_secured"
  | "redirecting";

interface FindResult {
  status:
    | "match"
    | "needs_last_name"
    | "ambiguous"
    | "not_found"
    | "invalid_link"
    | "rate_limited";
  mode?: "secure" | "light";
  token?: string;
  guest_id?: string;
}

interface CheckEmailResult {
  status:
    | "ok"
    | "email_mismatch"
    | "already_secured"
    | "invalid_email"
    | "not_found"
    | "invalid_link"
    | "rate_limited";
}

interface SecureResult {
  status:
    | "verified"
    | "not_authenticated"
    | "email_not_confirmed"
    | "email_mismatch"
    | "already_secured"
    | "not_found"
    | "invalid_link";
  token?: string;
  guest_id?: string;
  first_name?: string;
  last_name?: string | null;
}

interface AccessOption {
  guest_id: string;
  first_name: string;
  last_name: string | null;
}

interface AccessOptionsResult {
  status: "ok" | "not_authenticated";
  matches?: AccessOption[];
}

/** An error worded for the guest: shown as is, never replaced by a generic one. */
class GuestFacingError extends Error {}

/** A link under a step's answer that resets the form and goes back to a step. */
function BackTo({ to, label, onReset }: { to: View; label: string; onReset?: () => void }) {
  const flow = useFlow();
  return (
    <button
      type="button"
      className="tf-link"
      onClick={() => {
        onReset?.();
        flow.goTo(to);
      }}
    >
      {label}
    </button>
  );
}

/** "Resend code", without leaving the step unless the server says otherwise. */
function Resend({ label, onResend }: { label: string; onResend: () => Promise<View> }) {
  const flow = useFlow();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="tf-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailure(null);
          try {
            const next = await onResend();
            if (next !== "code") flow.goTo(next);
          } catch (reason) {
            setFailure(reason instanceof Error ? reason.message : null);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
      {failure ? (
        <p className="tf-error" role="alert">
          {failure}
        </p>
      ) : null}
    </>
  );
}

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
  const [askLastName, setAskLastName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [guestId, setGuestId] = useState<string | null>(null);
  // Not prefilled from this device's last sign-in: on a shared device that
  // is someone else's address.
  const [email, setEmail] = useState("");
  // Why the guest was sent back to the email step, if they were.
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const { captcha, getCaptchaToken } = useTurnstile();

  const partners =
    [preview.partner_one, preview.partner_two].filter(Boolean).join(" & ") ||
    t.guests.theCouple;

  const redirectToGuest = useCallback(
    (token: string): View => {
      markGroupLinkArrival(token);
      // They chose to respond on the faire-part: their invitation opens on
      // the RSVP, not on the hub.
      markRsvpHandoff(token);
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

  /**
   * Opens the invitation for the signed-in account, if it may. Returns the
   * outcome so each caller decides what a refusal means for it.
   */
  const secureWithSession = useCallback(
    async (id: string): Promise<SecureResult["status"]> => {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "secure_guest_invitation",
        { p_join_code: code, p_guest_id: id },
      );
      if (rpcError) throw rpcError;
      const result = data as unknown as SecureResult;
      if (result.status === "verified" && result.token) {
        redirectToGuest(result.token);
      }
      return result.status;
    },
    [code, redirectToGuest],
  );

  const findByName = async (withLastName: boolean): Promise<View> => {
    let result: FindResult;
    try {
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("find_guest_for_join", {
        p_join_code: code,
        p_first_name: firstName.trim(),
        p_last_name: withLastName ? lastName.trim() : null,
      });
      if (rpcError) throw rpcError;
      result = data as unknown as FindResult;

      if (result.status === "match") {
        if (result.mode === "light" && result.token) return redirectToGuest(result.token);
        if (result.guest_id) {
          setGuestId(result.guest_id);
          // No code when this device's account already holds this very
          // invitation. Anything else goes through the email step, so a
          // signed-in visitor typing someone else's name can never attach
          // their own email to that guest's invitation.
          const { data: auth } = await supabase.auth.getSession();
          if (auth.session) {
            const { data: own } = await supabase.rpc("get_guest_access_options", {
              p_join_code: code,
            });
            const mine = ((own as unknown as AccessOptionsResult | null)?.matches ?? []).some(
              (option) => option.guest_id === result.guest_id,
            );
            if (mine && (await secureWithSession(result.guest_id)) === "verified") return "redirecting";
          }
          setEmailNotice(null);
          return "email";
        }
      }
    } catch {
      throw new GuestFacingError(copy.genericError);
    }
    if (result.status === "needs_last_name") {
      setAskLastName(true);
      return "last_name";
    }
    if (result.status === "ambiguous") return "ambiguous";
    if (result.status === "rate_limited") throw new GuestFacingError(copy.rateLimited);
    return "not_found";
  };

  const requestCode = async (): Promise<View> => {
    const cleanEmail = email.trim();
    if (!guestId) throw new GuestFacingError(copy.genericError);
    if (!looksLikeEmail(cleanEmail)) throw new GuestFacingError(copy.invalidEmail);
    let result: CheckEmailResult;
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("check_join_email", {
        p_join_code: code,
        p_guest_id: guestId,
        p_email: cleanEmail,
      });
      if (rpcError) throw rpcError;
      result = data as unknown as CheckEmailResult;
    } catch {
      throw new GuestFacingError(copy.genericError);
    }
    if (result.status === "already_secured") return "already_secured";
    if (result.status !== "ok") {
      throw new GuestFacingError(
        result.status === "email_mismatch"
          ? copy.emailMismatch(partners)
          : result.status === "invalid_email"
            ? copy.invalidEmail
            : result.status === "rate_limited"
              ? copy.rateLimited
              : copy.genericError,
      );
    }
    try {
      await sendEmailOtp(cleanEmail, await getCaptchaToken());
    } catch {
      throw new GuestFacingError(copy.sendCodeError);
    }
    setOtp("");
    setCodeSent(true);
    return "code";
  };

  const submitCode = async (): Promise<View> => {
    if (!guestId) throw new GuestFacingError(copy.genericError);
    try {
      await verifyEmailOtp(email, otp);
    } catch {
      throw new GuestFacingError(copy.invalidCode);
    }
    let status: SecureResult["status"];
    try {
      status = await secureWithSession(guestId);
    } catch {
      throw new GuestFacingError(copy.genericError);
    }
    if (status === "verified") return "redirecting";
    if (status === "already_secured") return "already_secured";
    if (status === "email_mismatch") {
      setEmailNotice(copy.emailMismatch(partners));
      return "email";
    }
    throw new GuestFacingError(copy.genericError);
  };

  const startOver = () => {
    setFirstName("");
    setLastName("");
    setAskLastName(false);
    setGuestId(null);
    setCodeSent(false);
    setOtp("");
    setEmailNotice(null);
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
      key: "name",
      title: copy.title,
      description: copy.nameSubtitle,
      body: (
        <>
          <FlowText
            value={firstName}
            onChange={setFirstName}
            placeholder={copy.firstNameLabel}
            label={copy.firstNameLabel}
            autoComplete="given-name"
          />
          <p className="tf-note">{copy.securityNote}</p>
        </>
      ),
      valid: firstName.trim() !== "",
      okLabel: copy.continueButton,
      busyLabel: copy.searching,
      onNext: () => findByName(false),
    },
  ];

  if (askLastName) {
    steps.push({
      key: "last_name",
      title: copy.lastNameTitle,
      description: copy.lastNameSubtitle(firstName.trim()),
      body: (
        <>
          <FlowText
            value={lastName}
            onChange={setLastName}
            placeholder={copy.lastNameLabel}
            label={copy.lastNameLabel}
            autoComplete="family-name"
          />
          <div className="tf-links">
            <BackTo to="name" label={copy.tryAgainButton} onReset={startOver} />
          </div>
        </>
      ),
      valid: lastName.trim() !== "",
      okLabel: copy.continueButton,
      busyLabel: copy.searching,
      onNext: () => findByName(true),
    });
  }

  if (guestId) {
    steps.push({
      key: "email",
      title: copy.emailTitle,
      description: copy.emailSubtitle,
      body: withCaptcha(
        <>
          <FlowText
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setEmailNotice(null);
            }}
            placeholder={copy.emailPlaceholder}
            label={copy.emailLabel}
            autoComplete="email"
          />
          {emailNotice ? (
            <p className="tf-error" role="alert">
              {emailNotice}
            </p>
          ) : null}
          <div className="tf-links">
            <BackTo to="name" label={copy.someoneElse} onReset={startOver} />
          </div>
        </>,
      ),
      valid: email.trim() !== "",
      okLabel: copy.sendCodeButton,
      busyLabel: copy.sending,
      onNext: requestCode,
    });
  }

  if (codeSent) {
    steps.push({
      key: "code",
      title: copy.codeTitle,
      description: copy.codeSent(email.trim()),
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
            <Resend label={copy.resendButton} onResend={requestCode} />
            <BackTo to="email" label={copy.changeEmail} />
          </div>
        </>,
      ),
      valid: otp.trim() !== "",
      okLabel: copy.verifyButton,
      busyLabel: copy.verifying,
      onNext: submitCode,
    });
  }

  const ending = (key: View, title: string, body: string): FlowStep => ({
    key,
    kind: "end",
    before: <OliveBranch className="tf-ornament" />,
    title,
    description: body,
    okLabel: copy.tryAgainButton,
    onNext: () => {
      startOver();
      return "name";
    },
  });

  steps.push(
    ending("not_found", copy.notFoundTitle, copy.notFoundBody(partners)),
    ending("ambiguous", copy.ambiguousTitle, copy.ambiguousBody(partners)),
    ending("already_secured", copy.alreadySecuredTitle, copy.alreadySecuredBody(partners)),
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
      <Flow label={partners} steps={steps} topRight={<LocaleToggle />} />
    </DaRoot>
  );
}
