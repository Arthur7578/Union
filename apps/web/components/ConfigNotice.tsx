import React from "react";
import { T } from "@/lib/theme";

/**
 * Shown in place of the app when Supabase env vars are missing, so a fresh
 * clone renders something helpful instead of throwing.
 */
export function ConfigNotice() {
  return (
    <main className="page">
      <div className="card" style={{ textAlign: "center" }}>
        <div className="brand">Union</div>
        <h1 className="couple" style={{ fontFamily: T.serif }}>
          Almost there
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code>apps/web/.env.local</code> to connect the planning app to your
          Supabase project, then reload.
        </p>
      </div>
    </main>
  );
}
