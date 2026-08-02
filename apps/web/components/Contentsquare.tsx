"use client";

import { useEffect, useRef } from "react";
import { injectContentsquareScript } from "@contentsquare/tag-sdk";

export function Contentsquare() {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined") return;

    // Retrieve client ID from environment variable
    const clientId = process.env.NEXT_PUBLIC_CONTENTSQUARE_CLIENT_ID;

    // Gate execution to avoid running on:
    // 1. Environments without a configured client ID.
    // 2. Non-production node environments.
    // 3. Vercel non-production preview or development deployments.
    const isProduction =
      process.env.NODE_ENV === "production" &&
      (!process.env.NEXT_PUBLIC_VERCEL_ENV ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production");

    if (!clientId) {
      console.warn("Contentsquare: clientId not found. Script injection skipped.");
      return;
    }

    if (!isProduction) {
      console.log(
        "Contentsquare: Gated to production only. Script injection skipped in development/preview."
      );
      return;
    }

    // Guard against double-injection if component remounts
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      injectContentsquareScript({ clientId });
    } catch (error) {
      // Gracefully handle any loading, network, or adblocker-induced load failures
      console.error("Contentsquare failed to initialize:", error);
    }
  }, []);

  return null;
}
