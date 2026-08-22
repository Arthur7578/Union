"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  SHOW_FLOATING_LAUNCHER,
  USERJOT_LOADER_SNIPPET,
  USERJOT_PROJECT_ID,
} from "@/lib/userjot";

/**
 * Loads the UserJot SDK from the root layout so the feedback panel is
 * available on every page.
 *
 * The SDK's own floating launcher is off (`SHOW_FLOATING_LAUNCHER`) — it
 * covered the mobile tab bar and the bottom-anchored actions across the app.
 * The way in is the Help & feedback section of the account area, which calls
 * `ujShowWidget()`.
 */
export function UserJot() {
  useLiftWidgetAboveTabbar();
  return (
    <>
      <Script id="userjot-loader" strategy="afterInteractive">
        {USERJOT_LOADER_SNIPPET}
      </Script>
      <Script id="userjot-init" strategy="afterInteractive">
        {`window.uj.init('${USERJOT_PROJECT_ID}', { widget: ${SHOW_FLOATING_LAUNCHER}, position: 'right', theme: 'auto' });`}
      </Script>
    </>
  );
}

/**
 * Only relevant when the floating launcher is switched back on.
 *
 * The UserJot SDK mounts its widget inside `#userjot-widget-container`, whose
 * launcher lives in an open shadow root as a Tailwind-styled div
 * (`.fixed.bottom-5.right-5`). External CSS can't reach into the shadow root,
 * so we inject a `<style>` element into it that lifts the launcher above our
 * fixed `.u-tabbar` on viewports below the desktop breakpoint (960px).
 */
function useLiftWidgetAboveTabbar() {
  useEffect(() => {
    if (!SHOW_FLOATING_LAUNCHER) return;

    const STYLE_ID = "uj-lift-above-tabbar";
    const CSS = `
      @media (max-width: 959px) {
        .fixed.bottom-5.right-5,
        .fixed.bottom-5.left-5 {
          bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important;
        }
      }
    `;

    const injectInto = (root: ShadowRoot) => {
      if (root.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      root.appendChild(style);
    };

    const tryInject = () => {
      const host = document.getElementById("userjot-widget-container");
      const root = host?.shadowRoot;
      if (root) {
        injectInto(root);
        return true;
      }
      return false;
    };

    if (tryInject()) return;

    // The SDK inserts the host lazily; watch for it and inject once it lands.
    const observer = new MutationObserver(() => {
      if (tryInject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety fallback: stop polling after 20s regardless.
    const interval = window.setInterval(() => {
      if (tryInject()) {
        observer.disconnect();
        window.clearInterval(interval);
      }
    }, 1000);
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      window.clearInterval(interval);
    }, 20000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);
}
