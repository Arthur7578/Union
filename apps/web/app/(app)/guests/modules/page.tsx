"use client";

import React, { useState } from "react";
import {
  GUEST_MODULE_KEYS,
  resolveGuestModules,
  toStoredGuestModules,
  type GuestModuleKey,
  type GuestModules,
  type Wedding,
} from "@union/shared";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { updateWedding } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { BackHeader } from "@/components/BackHeader";
import { Button, SectionLabel, Switch, Loading } from "@/components/ui";

/**
 * Which sections of the guest invitation this wedding shows.
 *
 * The guest portal renders four modules; a wedding with no room blocks and no
 * carpooling has nothing to put behind two of them, and an empty tab reads as
 * a couple who forgot to fill it in rather than a wedding that doesn't need
 * it. Turning one off here hides it for every guest of this wedding —
 * it's presentation only, so nothing a guest has already submitted is touched
 * and turning a module back on brings their answers back with it.
 */
export default function GuestModulesPage() {
  const { wedding, refresh } = useWedding();

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  return (
    <GuestModulesForm key={wedding.id} wedding={wedding} refresh={refresh} />
  );
}

function GuestModulesForm({
  wedding,
  refresh,
}: {
  wedding: Wedding;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [modules, setModules] = useState<GuestModules>(() =>
    resolveGuestModules(wedding.guest_modules),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const COPY: Record<GuestModuleKey, { label: string; sub: string }> = {
    forms: { label: t.guests.modules.formsLabel, sub: t.guests.modules.formsSub },
    travel: { label: t.guests.modules.travelLabel, sub: t.guests.modules.travelSub },
    logistics: {
      label: t.guests.modules.logisticsLabel,
      sub: t.guests.modules.logisticsSub,
    },
    faq: { label: t.guests.modules.faqLabel, sub: t.guests.modules.faqSub },
  };

  const enabledCount = GUEST_MODULE_KEYS.filter((k) => modules[k]).length;

  const toggle = (key: GuestModuleKey) => {
    // The last module can't go. The database refuses it too, but a guest-facing
    // invitation with no sections at all is worth explaining here rather than
    // surfacing as a constraint violation after a save.
    if (modules[key] && enabledCount === 1) {
      setError(t.guests.modules.lastOneError);
      return;
    }
    setError(null);
    setSaved(false);
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledCount === 0) {
      setError(t.guests.modules.lastOneError);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Only the "off" decisions are stored, so a module added to the portal
      // later starts out visible instead of silently missing.
      await updateWedding(wedding.id, {
        guest_modules: toStoredGuestModules(modules),
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.guests.modules.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title={t.guests.modules.title}
        subtitle={t.guests.modules.subtitle}
        fallback="/guests"
      />

      <form onSubmit={save}>
        <SectionLabel style={{ marginTop: 0 }}>
          {t.guests.modules.sectionLabel}
        </SectionLabel>

        <div
          style={{
            borderRadius: 18,
            background: T.surface,
            border: `1px solid ${T.line}`,
            overflow: "hidden",
          }}
        >
          {GUEST_MODULE_KEYS.map((key, i) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 15px",
                borderBottom:
                  i === GUEST_MODULE_KEYS.length - 1
                    ? "none"
                    : `1px solid ${T.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}
                >
                  {COPY[key].label}
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>
                  {COPY[key].sub}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    marginTop: 5,
                    fontWeight: 600,
                    color: modules[key] ? T.green : T.faint,
                  }}
                >
                  {modules[key]
                    ? t.guests.modules.activated
                    : t.guests.modules.deactivated}
                </div>
              </div>
              <Switch
                on={modules[key]}
                onChange={() => toggle(key)}
                label={COPY[key].label}
              />
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: T.faint, margin: "10px 4px 14px" }}>
          {t.guests.modules.previewNote}
        </div>

        {error && (
          <div className="error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}

        <Button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy
            ? t.guests.modules.saving
            : saved
              ? t.guests.modules.saved
              : t.guests.modules.save}
        </Button>
      </form>
    </main>
  );
}
