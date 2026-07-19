"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (production only) so Union can launch offline
 * and behave like an installed app. Kept out of dev to avoid caching surprises
 * while iterating.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* registration is best-effort; ignore failures */
        });
    };

    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
