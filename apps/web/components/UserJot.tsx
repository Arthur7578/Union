"use client";

import Script from "next/script";
import { useEffect } from "react";
import { USERJOT_LOADER_SNIPPET, USERJOT_PROJECT_ID } from "@/lib/userjot";

/**
 * Loads the UserJot SDK and initializes the feedback widget app-wide.
 * Rendered from the root layout so the widget is available on every page.
 */
export function UserJot() {
  useLiftWidgetAboveTabbar();
  return (
    <>
      <Script id="userjot-loader" strategy="afterInteractive">
        {USERJOT_LOADER_SNIPPET}
      </Script>
      <Script id="userjot-init" strategy="afterInteractive">
        {`window.uj.init('${USERJOT_PROJECT_ID}', { widget: true, position: 'right', theme: 'auto' });`}
      </Script>
    </>
  );
}

/**
 * The UserJot SDK renders a floating launcher in the viewport's bottom-right,
 * which overlaps our fixed `.u-tabbar` on mobile. The SDK's exact selector /
 * shadow-DOM layout isn't public, so instead of guessing selectors we find the
 * launcher by shape — a body-level element pinned to the bottom edge that
 * isn't our own tab bar — and tag it with `.uj-lift-above-tabbar` (styled in
 * globals.css under a `max-width: 959px` media query).
 */
function useLiftWidgetAboveTabbar() {
  useEffect(() => {
    const CLASS = "uj-lift-above-tabbar";

    const isWidgetHost = (el: Element): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.classList.contains("u-tabbar")) return false;
      const tag = el.tagName.toLowerCase();
      const id = (el.id || "").toLowerCase();
      const cls = (el.className || "").toString().toLowerCase();
      const nameMatch =
        tag.includes("userjot") ||
        tag.startsWith("uj-") ||
        id.includes("userjot") ||
        id.startsWith("uj-") ||
        cls.includes("userjot") ||
        cls.includes("uj-widget") ||
        cls.includes("uj-launcher");
      if (nameMatch) return true;

      // Fallback: any body-level element pinned bottom-right with a very
      // high z-index (widgets like this are almost always on top of the app).
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") return false;
      const z = parseInt(cs.zIndex, 10);
      if (!Number.isFinite(z) || z < 100) return false;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nearRight = vw - rect.right < 80;
      const nearBottom = vh - rect.bottom < 120;
      return nearRight && nearBottom;
    };

    const tag = () => {
      for (const el of Array.from(document.body.children)) {
        if (isWidgetHost(el)) el.classList.add(CLASS);
      }
    };

    tag();
    const observer = new MutationObserver(tag);
    observer.observe(document.body, { childList: true, subtree: false });
    const interval = window.setInterval(tag, 1500);
    window.setTimeout(() => window.clearInterval(interval), 15000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);
}
