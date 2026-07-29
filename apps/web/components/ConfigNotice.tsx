"use client";

import React from "react";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";

/**
 * Shown in place of the app when Supabase env vars are missing, so a fresh
 * clone renders something helpful instead of throwing.
 */
export function ConfigNotice() {
  const t = useT();
  return (
    <main className="page">
      <div className="card" style={{ textAlign: "center" }}>
        <div className="brand">Union</div>
        <h1 className="couple" style={{ fontFamily: T.serif }}>
          {t.configNotice.title}
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {t.configNotice.body}
        </p>
      </div>
    </main>
  );
}
