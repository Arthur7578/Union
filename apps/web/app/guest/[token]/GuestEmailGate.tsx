"use client";

import React, { useState } from "react";
import { DaRoot } from "@/components/guest/DaRoot";
import { Flow, useFlow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowText } from "@/components/guest/flow/fields";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import { writeActiveGuestIdentity } from "@/lib/guestIdentity";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { useTurnstile } from "@/lib/turnstile";

interface CompleteEmailSetupResult {
  status:
    | "verified"
    | "not_authenticated"
    | "email_not_verified"
    | "email_already_set"
    | "not_found";
}

/** Under the code: send it again, or go back and use another address. */
function CodeLinks({ onResend }: { onResend: () => Promise<void> }) {
  const { t } = useLocale();
  const flow = useFlow();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <div className="tf-links">
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
          {busy ? t.guestEmailSetup.sending : t.guestEmailSetup.resend}
        </button>
        <button type="button" className="tf-link" disabled={busy} onClick={() => flow.goTo("email")}>
          {t.guestEmailSetup.changeEmail}
        </button>
      </div>
      {failed ? (
        <p className="tf-error" role="alert">
          {t.guestEmailSetup.sendError}
        </p>
      ) : null}
    </>
  );
}

/**
 * A guest with no e-mail on file adds one, verified by a one-time code,
 * before reaching the hub — asked one question at a time, like every guest
 * form.
 */
export function GuestEmailGate({
  token,
  guestId,
  guestName,
  emailMissing,
  children,
}: {
  token: string;
  guestId: string;
  guestName: string;
  emailMissing: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const copy = t.guestEmailSetup;
  const [done, setDone] = useState(!emailMissing);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const { captcha, getCaptchaToken } = useTurnstile();

  if (done) return <>{children}</>;

  const requestCode = async () => {
    await sendEmailOtp(email, await getCaptchaToken());
    setCode("");
  };

  const verify = async () => {
    try {
      await verifyEmailOtp(email, code);
      const supabase = getBrowserSupabase();
      const { data, error: rpcError } = await supabase.rpc("complete_guest_email_setup", { p_token: token });
      if (rpcError) throw rpcError;

      const result = data as unknown as CompleteEmailSetupResult;
      if (result.status !== "verified") throw new Error(result.status);

      const { data: authData } = await supabase.auth.getSession();
      if (authData.session) {
        writeActiveGuestIdentity({ userId: authData.session.user.id, guestId, guestName });
      }
    } catch {
      throw new Error(copy.verifyError);
    }
    setDone(true);
    return false;
  };

  const steps: FlowStep[] = [
    {
      key: "email",
      title: copy.title,
      description: copy.subtitle,
      body: (
        <>
          <FlowText
            type="email"
            value={email}
            onChange={setEmail}
            placeholder={copy.emailPlaceholder}
            label={copy.emailLabel}
            autoComplete="email"
          />
          {captcha ? <div className="tf-captcha">{captcha}</div> : null}
        </>
      ),
      valid: email.trim() !== "",
      okLabel: copy.sendCode,
      busyLabel: copy.sending,
      onNext: async () => {
        try {
          await requestCode();
        } catch {
          throw new Error(copy.sendError);
        }
      },
    },
    {
      key: "code",
      title: copy.codeTitle,
      description: copy.codeSent(email),
      body: (
        <>
          <FlowText
            value={code}
            onChange={setCode}
            placeholder={copy.codePlaceholder}
            label={copy.codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="tf-code"
          />
          {captcha ? <div className="tf-captcha">{captcha}</div> : null}
          <CodeLinks onResend={requestCode} />
        </>
      ),
      valid: code.trim() !== "",
      okLabel: copy.verify,
      busyLabel: copy.verifying,
      onNext: verify,
    },
  ];

  return (
    <DaRoot>
      <Flow label={copy.kicker} steps={steps} topRight={<LocaleToggle />} />
    </DaRoot>
  );
}
