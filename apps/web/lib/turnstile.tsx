"use client";

import React, { useCallback, useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, used to satisfy Supabase Auth's CAPTCHA protection.
 *
 * The site key is public by design (the secret lives in the Supabase
 * dashboard). With no key configured nothing renders and no token is sent, so
 * every sign-in flow keeps working exactly as before until CAPTCHA protection
 * is switched on.
 *
 * The challenge runs when the user submits rather than on page load: a token
 * is single-use and expires after a few minutes, so one solved ahead of time
 * would often be stale by the time it is needed. `appearance:
 * "interaction-only"` keeps the widget invisible unless Cloudflare decides it
 * cannot vouch for the visitor without them clicking something.
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Upper bound on one challenge, so a stalled network can't leave a form
 *  stuck in its "sending…" state. */
const CHALLENGE_TIMEOUT_MS = 30_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      retry?: "auto" | "never";
      "refresh-expired"?: "auto" | "manual" | "never";
      "refresh-timeout"?: "auto" | "manual" | "never";
      callback?: (token: string) => void;
      /** Returning `true` tells Turnstile the error has been handled. */
      "error-callback"?: (errorCode: string) => boolean | void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** The challenge could not be completed. Callers show their own localized
 *  "couldn't send the code" message rather than this one. */
export class CaptchaError extends Error {
  /** Turnstile's own error code when it supplied one (e.g. "110200"). */
  readonly code?: string;

  constructor(message = "CAPTCHA verification failed.", code?: string) {
    super(message);
    this.name = "CaptchaError";
    this.code = code;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new CaptchaError("Turnstile did not initialise."));
    script.onerror = () => {
      // Forget the failure so the next attempt retries the download.
      scriptPromise = null;
      script.remove();
      reject(new CaptchaError("Turnstile could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Mount point. Render it inside the form, near the submit button; it stays
   *  empty unless Cloudflare needs the visitor to interact. `null` when no
   *  site key is configured. */
  captcha: React.ReactNode;
  /** Resolves a fresh single-use token, or `undefined` when CAPTCHA is not
   *  configured. Rejects with a `CaptchaError` if the challenge fails. */
  getCaptchaToken: () => Promise<string | undefined>;
}

export function useTurnstile(): TurnstileHandle {
  const containerRef = useRef<HTMLDivElement>(null);
  // Tears down whichever challenge is in flight (widget, timer, pending promise).
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const getCaptchaToken = useCallback(async (): Promise<string | undefined> => {
    if (!TURNSTILE_SITE_KEY) return undefined;

    cancelRef.current?.();
    const api = await loadTurnstile();
    const container = containerRef.current;
    if (!container) throw new CaptchaError("CAPTCHA container is not mounted.");

    return new Promise<string>((resolve, reject) => {
      let widgetId: string | undefined;
      let settled = false;

      const removeWidget = () => {
        if (widgetId === undefined) return;
        try {
          api.remove(widgetId);
        } catch {
          // Already gone (e.g. the container unmounted) — nothing to undo.
        }
      };
      // Settles once; later callbacks (a token expiring after delivery, a
      // timeout racing a success) are ignored.
      const settle = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        removeWidget();
        cancelRef.current = null;
        outcome();
      };
      const succeed = (token: string) => settle(() => resolve(token));
      const fail = (code?: string) =>
        settle(() =>
          reject(
            new CaptchaError(
              code
                ? `CAPTCHA verification failed (Turnstile error ${code}).`
                : undefined,
              code,
            ),
          ),
        );

      const timer = window.setTimeout(() => fail(), CHALLENGE_TIMEOUT_MS);
      cancelRef.current = fail;
      try {
        widgetId = api.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          // This widget lives for one submit and is removed the moment it
          // settles. Turnstile's own retry / auto-refresh would schedule a
          // reset() against the widget we just removed and throw "Nothing to
          // reset found" a couple of seconds later, so switch them all off.
          retry: "never",
          "refresh-expired": "never",
          "refresh-timeout": "never",
          callback: succeed,
          "error-callback": (code) => {
            // Cloudflare's code (110200 = hostname not allowed for this widget,
            // for instance) is the only clue why a challenge failed; the
            // caller's localized message can't carry it.
            console.warn(`[turnstile] challenge failed (error ${code})`);
            fail(code);
            return true;
          },
          "expired-callback": () => fail(),
          "timeout-callback": () => fail(),
        });
      } catch {
        fail();
        return;
      }
      // A callback that fires before render() returns its id has already
      // settled the promise with nothing yet to remove; clean up now.
      if (settled) removeWidget();
    });
  }, []);

  return {
    // `display: contents` so the empty mount point takes no space — not even a
    // row's worth of `gap` when the parent is a grid. A challenge that does
    // need a click lays out as a direct child of the form.
    captcha: TURNSTILE_SITE_KEY ? (
      <div ref={containerRef} style={{ display: "contents" }} />
    ) : null,
    getCaptchaToken,
  };
}
