"use client";

import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import { updateWedding } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, SectionLabel, Loading } from "@/components/ui";

type ToggleValue = boolean;

/**
 * Wedding-level defaults that decide what a guest can do from their
 * own invite. Per-guest overrides live on the guest edit page
 * ("Inherit wedding default | Yes | No"); this screen sets what
 * "inherit" resolves to.
 */
export default function GuestPermissionsPage() {
  const { wedding, refresh } = useWedding();
  const [allowPartner, setAllowPartner] = useState<ToggleValue>(false);
  const [allowKids, setAllowKids] = useState<ToggleValue>(false);
  const [maxKidsMode, setMaxKidsMode] = useState<"unlimited" | "capped">("unlimited");
  const [maxKidsCap, setMaxKidsCap] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!wedding) return;
    setAllowPartner(wedding.allow_guests_add_partner);
    setAllowKids(wedding.allow_guests_add_children);
    if (wedding.max_children_per_guest == null) {
      setMaxKidsMode("unlimited");
      setMaxKidsCap("");
    } else {
      setMaxKidsMode("capped");
      setMaxKidsCap(String(wedding.max_children_per_guest));
    }
  }, [wedding]);

  if (!wedding)
    return (
      <main className="u-main">
        <Loading />
      </main>
    );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let cap: number | null = null;
      if (allowKids && maxKidsMode === "capped") {
        const parsed = parseInt(maxKidsCap, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError("Enter a whole number of children (0 or more), or pick “No cap”.");
          setBusy(false);
          return;
        }
        cap = Math.min(50, parsed);
      }
      await updateWedding(wedding.id, {
        allow_guests_add_partner: allowPartner,
        allow_guests_add_children: allowKids,
        max_children_per_guest: cap,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title="Guest permissions"
        subtitle="What guests can do from their own invite. Set the defaults here — you can still override any guest one by one on their detail page."
        fallback="/guests"
      />

      <form onSubmit={save}>
        <SectionLabel style={{ marginTop: 0 }}>Adding a partner</SectionLabel>
        <Card>
          <ToggleRow
            id="allow-partner"
            label="Allow guests to add a partner from their RSVP"
            hint="Turn on if your default invitation is 'plus one'. A guest whose per-person override says otherwise still wins."
            value={allowPartner}
            onChange={setAllowPartner}
          />
        </Card>

        <SectionLabel>Adding children</SectionLabel>
        <Card>
          <ToggleRow
            id="allow-kids"
            label="Allow guests to add children from their RSVP"
            hint="Useful when kids are welcome by default. Per-guest overrides still apply."
            value={allowKids}
            onChange={setAllowKids}
          />
          {allowKids && (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: T.muted }}>Cap per guest</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="radio"
                  name="max-kids"
                  checked={maxKidsMode === "unlimited"}
                  onChange={() => setMaxKidsMode("unlimited")}
                />
                No cap — a guest can register as many children as they need
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="radio"
                  name="max-kids"
                  checked={maxKidsMode === "capped"}
                  onChange={() => setMaxKidsMode("capped")}
                />
                Cap at
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={maxKidsCap}
                  onChange={(e) => {
                    setMaxKidsCap(e.target.value);
                    setMaxKidsMode("capped");
                  }}
                  onFocus={() => setMaxKidsMode("capped")}
                  placeholder="e.g. 3"
                  style={{ width: 80 }}
                />
                children per guest
              </label>
            </div>
          )}
        </Card>

        <div style={{ fontSize: 12, color: T.faint, margin: "10px 4px 14px" }}>
          Each guest can override these defaults on their own detail page —
          look for "Can add a partner from their RSVP" and "Can add children
          from their RSVP".
        </div>

        {error && (
          <div className="error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}
        <Button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Saving…" : saved ? "Saved" : "Save defaults"}
        </Button>
      </form>
    </main>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        cursor: "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: T.ink }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>
            {hint}
          </div>
        )}
      </div>
    </label>
  );
}
