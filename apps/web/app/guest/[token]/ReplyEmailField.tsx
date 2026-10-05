"use client";

import { useState, useSyncExternalStore } from "react";
import { looksLikeEmail, suggestEmailFix } from "@/lib/emailSuggest";
import { arrivedThroughGroupLink } from "@/lib/groupLinkArrival";
import { useLocale } from "@/lib/i18n/client";
import { T } from "@/lib/theme";
import { getBrowserSupabase } from "@/lib/supabaseClient";

const noopSubscribe = () => () => {};

/**
 * The email a guest gives when they reply, for a guest the couple has no
 * email for. Required when they came through the group link, so the couple
 * ends up with everyone's address; optional on a personal link, which the
 * couple hands out to guests who'd struggle (older guests, children).
 *
 * The address is saved as given by the guest, unconfirmed. It can't replace
 * one already on file: only the couple can change that.
 */
export function useReplyEmail({
  token,
  emailMissing,
  isDemo,
}: {
  token: string;
  emailMissing: boolean;
  isDemo: boolean;
}) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(!emailMissing);
  const [error, setError] = useState<string | null>(null);
  // sessionStorage is only readable in the browser: the server render
  // treats the email as optional.
  const required = useSyncExternalStore(
    noopSubscribe,
    () => arrivedThroughGroupLink(token),
    () => false,
  );

  /** Saves the email if one is due. Resolves false when the reply should wait. */
  const save = async (): Promise<boolean> => {
    if (saved) return true;
    const clean = email.trim();
    if (!clean) {
      if (!required) return true;
      setError(t.replyEmail.required);
      return false;
    }
    if (!looksLikeEmail(clean)) {
      setError(t.replyEmail.invalid);
      return false;
    }
    setError(null);
    if (isDemo) {
      setSaved(true);
      return true;
    }
    const { data, error: rpcError } = await getBrowserSupabase().rpc(
      "set_guest_email",
      { p_token: token, p_email: clean },
    );
    const status = (data as { status?: string } | null)?.status;
    if (rpcError || (status !== "ok" && status !== "email_already_set")) {
      setError(status === "invalid_email" ? t.replyEmail.invalid : t.replyEmail.saveError);
      return false;
    }
    setSaved(true);
    return true;
  };

  return {
    show: !saved,
    required,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setError(null);
    },
    error,
    save,
  };
}

export type ReplyEmail = ReturnType<typeof useReplyEmail>;

export function ReplyEmailField({
  state,
  couple,
}: {
  state: ReplyEmail;
  couple: string;
}) {
  const { t } = useLocale();
  if (!state.show) return null;
  const suggestion = suggestEmailFix(state.email);

  return (
    <div className="field">
      <label htmlFor="reply-email">✉️ {t.replyEmail.label}</label>
      <input
        id="reply-email"
        type="email"
        autoComplete="email"
        value={state.email}
        onChange={(e) => state.setEmail(e.target.value)}
        placeholder={t.replyEmail.placeholder}
        required={state.required}
      />
      {suggestion && (
        <button
          type="button"
          onClick={() => state.setEmail(suggestion)}
          style={{
            background: "none",
            border: "none",
            padding: "6px 0 0",
            color: "var(--accent)",
            fontSize: "13px",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {t.replyEmail.suggestion(suggestion)}
        </button>
      )}
      <p style={{ color: "var(--muted)", fontSize: "12px", margin: "6px 0 0" }}>
        {state.required ? t.replyEmail.hintRequired(couple) : t.replyEmail.hintOptional(couple)}
      </p>
      {state.error && (
        <p role="alert" style={{ color: T.danger, fontSize: "13px", margin: "6px 0 0" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}
