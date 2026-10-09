"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
 * one already on file: only the couple can change that. So before saving,
 * the guest is asked whether it is right, with a fix offered for a likely
 * typo in the domain.
 *
 * Once an email is on file the field stays on the form, read-only: the one
 * the guest just gave in full, or the server's masked hint on a later visit.
 */
export function useReplyEmail({
  token,
  emailMissing,
  emailHint,
  isDemo,
}: {
  token: string;
  emailMissing: boolean;
  /** The email on file with its local part masked, when there is one. */
  emailHint: string | null;
  isDemo: boolean;
}) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(!emailMissing);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // sessionStorage is only readable in the browser: the server render
  // treats the email as optional.
  const required = useSyncExternalStore(
    noopSubscribe,
    () => arrivedThroughGroupLink(token),
    () => false,
  );

  /**
   * Saves the email if one is due. Resolves false when the reply should wait,
   * including while the guest hasn't yet said the address is right: pass the
   * address they confirmed to go ahead.
   */
  const save = async (confirmed?: string): Promise<boolean> => {
    if (saved) return true;
    const clean = (confirmed ?? email).trim();
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
    if (confirmed === undefined) {
      setConfirming(true);
      return false;
    }
    if (!isDemo) {
      const { data, error: rpcError } = await getBrowserSupabase().rpc(
        "set_guest_email",
        { p_token: token, p_email: clean },
      );
      const status = (data as { status?: string } | null)?.status;
      if (rpcError || (status !== "ok" && status !== "email_already_set")) {
        setError(status === "invalid_email" ? t.replyEmail.invalid : t.replyEmail.saveError);
        return false;
      }
      // Someone else's address got there first: show the one on file, not
      // the one that wasn't saved.
      if (status === "email_already_set") {
        setSaved(true);
        return true;
      }
    }
    setSavedEmail(clean.toLowerCase());
    setSaved(true);
    return true;
  };

  return {
    saved,
    /** What to show for the email on file: the full address the guest just
     *  gave, else the masked hint. Null when neither is known. */
    onFile: savedEmail ?? emailHint,
    required,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setConfirming(false);
      setError(null);
    },
    confirming,
    /** The guest says `value` is their address: fill it in and stop asking. */
    confirm: (value: string) => {
      setEmail(value);
      setConfirming(false);
    },
    /** Back to the input, to fix the address. */
    edit: () => setConfirming(false),
    error,
    save,
  };
}

export type ReplyEmail = ReturnType<typeof useReplyEmail>;

export function ReplyEmailField({
  state,
  couple,
  onConfirmed,
}: {
  state: ReplyEmail;
  couple: string;
  /** Runs once the guest confirms their address, with that address: send
   *  the reply again, handing it to `state.save`. */
  onConfirmed: (email: string) => void;
}) {
  const { t } = useLocale();

  if (state.saved) {
    return (
      <div className="field">
        <label htmlFor="reply-email-on-file">✉️ {t.replyEmail.label}</label>
        {state.onFile && (
          <input
            id="reply-email-on-file"
            type="text"
            value={state.onFile}
            readOnly
            aria-readonly="true"
            style={{ color: "var(--muted)" }}
          />
        )}
        <p style={{ color: "var(--muted)", fontSize: "12px", margin: "6px 0 0" }}>
          {state.onFile ? t.replyEmail.onFile(couple) : t.replyEmail.onFileNoHint(couple)}
        </p>
      </div>
    );
  }

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
      {suggestion && !state.confirming && (
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
      {state.confirming ? (
        <ConfirmEmail
          typed={state.email.trim()}
          suggestion={suggestion}
          couple={couple}
          onUse={(value) => {
            state.confirm(value);
            onConfirmed(value);
          }}
          onEdit={state.edit}
        />
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "12px", margin: "6px 0 0" }}>
          {state.required ? t.replyEmail.hintRequired(couple) : t.replyEmail.hintOptional(couple)}
        </p>
      )}
      {state.error && (
        <p role="alert" style={{ color: T.danger, fontSize: "13px", margin: "6px 0 0" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

/** "Is this right?" before an address the guest can't change later is saved.
 *  A likely typo leads with the fix. */
function ConfirmEmail({
  typed,
  suggestion,
  couple,
  onUse,
  onEdit,
}: {
  typed: string;
  suggestion: string | null;
  couple: string;
  onUse: (email: string) => void;
  onEdit: () => void;
}) {
  const { t } = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    box.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    primary.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={box}
      role="group"
      aria-labelledby="reply-email-confirm-title"
      style={{
        marginTop: "10px",
        padding: "14px",
        borderRadius: "12px",
        border: "1.5px solid var(--accent)",
        background: "var(--card-bg)",
      }}
    >
      <p id="reply-email-confirm-title" style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 6px" }}>
        {suggestion ? t.replyEmail.suggestion(suggestion) : t.replyEmail.confirmTitle}
      </p>
      {suggestion ? (
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 12px" }}>
          {t.replyEmail.suggestionBody(typed)}
        </p>
      ) : (
        <>
          <p style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 6px", wordBreak: "break-all" }}>
            {typed}
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 12px" }}>
            {t.replyEmail.confirmBody(couple)}
          </p>
        </>
      )}
      <div className="choice-row" style={{ flexWrap: "wrap" }}>
        {suggestion ? (
          <>
            <button
              ref={primary}
              type="button"
              className="choice-btn selected-yes"
              onClick={() => onUse(suggestion)}
            >
              {t.replyEmail.useSuggestion(suggestion)}
            </button>
            <button type="button" className="choice-btn" onClick={() => onUse(typed)}>
              {t.replyEmail.keepTyped}
            </button>
          </>
        ) : (
          <>
            <button
              ref={primary}
              type="button"
              className="choice-btn selected-yes"
              onClick={() => onUse(typed)}
            >
              {t.replyEmail.confirmYes}
            </button>
            <button type="button" className="choice-btn" onClick={onEdit}>
              {t.replyEmail.confirmEdit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
