"use client";

import Script from "next/script";
import { USERJOT_LOADER_SNIPPET, USERJOT_PROJECT_ID } from "@/lib/userjot";

/**
 * Loads the UserJot SDK and initializes the feedback widget app-wide.
 * Rendered from the root layout so the widget is available on every page.
 */
export function UserJot() {
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
