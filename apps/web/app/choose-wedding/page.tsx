"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { formatShortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/client";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";

export default function ChooseWeddingPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { session, loading: authLoading, signOut } = useAuth();
  const { weddings, loading: weddingLoading, setWedding } = useWedding();

  useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace("/sign-in");
    else if (!weddingLoading && weddings.length === 0) router.replace("/onboarding");
  }, [authLoading, session, weddingLoading, weddings.length, router]);

  if (authLoading || weddingLoading || !session || weddings.length === 0) {
    return (
      <main className="page">
        <Loading label={t.weddingPicker.loading} />
      </main>
    );
  }

  const choose = (selected: (typeof weddings)[number]) => {
    setWedding(selected);
    router.replace("/today");
  };

  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <main className="page">
      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <Spark size={26} color={T.accent} />
          <h1
            className="u-serif"
            style={{ fontSize: 32, fontWeight: 600, color: T.ink, margin: "8px 0 4px" }}
          >
            {t.weddingPicker.title}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {t.weddingPicker.sub}
          </p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {weddings.map((w) => {
            const couple =
              [w.partner_one, w.partner_two].filter(Boolean).join(" & ") ||
              t.weddingPicker.untitled;
            const detail = [w.venue_name, formatShortDate(w.event_date, locale)]
              .filter(Boolean)
              .join(" · ");
            const role =
              w.owner_id === session.user.id
                ? t.weddingPicker.owner
                : t.weddingPicker.coOrganiser;

            return (
              <button
                type="button"
                key={w.id}
                onClick={() => choose(w)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  textAlign: "left",
                  gap: 14,
                  padding: "17px 18px",
                  background: T.surface,
                  border: `1px solid ${T.line}`,
                  borderRadius: 20,
                  boxShadow: "0 6px 18px rgba(67,53,58,.05)",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="u-serif" style={{ fontSize: 22, fontWeight: 600, color: T.ink }}>
                    {couple}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.faint, marginTop: 3 }}>
                    {[role, detail].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span style={{ color: T.accent, fontWeight: 700, fontSize: 20 }}>→</span>
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          onClick={doSignOut}
          style={{ width: "100%", marginTop: 16 }}
        >
          {t.weddingPicker.differentAccount}
        </Button>
      </div>
    </main>
  );
}
