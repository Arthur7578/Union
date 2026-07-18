"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { Spark } from "@/components/icons";
import { Button, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useWedding } from "@/lib/wedding";
import { createWedding } from "@/lib/data";

export default function OnboardingPage() {
  const { session, loading: authLoading } = useAuth();
  const { wedding, loading: wLoading, setWedding } = useWedding();
  const router = useRouter();

  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace("/sign-in");
    else if (!wLoading && wedding) router.replace("/today");
  }, [authLoading, session, wLoading, wedding, router]);

  if (authLoading || (session && wLoading) || (session && wedding)) {
    return (
      <main className="page">
        <Loading label="One moment…" />
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      const w = await createWedding({
        owner_id: session.user.id,
        partner_one: partnerOne.trim() || null,
        partner_two: partnerTwo.trim() || null,
        event_date: eventDate || null,
        venue_name: venueName.trim() || null,
        venue_address: null,
      });
      setWedding(w);
      router.replace("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <Spark size={26} color={T.accent} />
          <h1
            className="u-serif"
            style={{ fontSize: 32, fontWeight: 600, color: T.ink, margin: "8px 0 4px" }}
          >
            Let&apos;s set up your wedding
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Just the basics — you can change any of this later.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="p1">Your name</label>
            <input
              id="p1"
              type="text"
              value={partnerOne}
              onChange={(e) => setPartnerOne(e.target.value)}
              placeholder="Maya"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="p2">Partner&apos;s name</label>
            <input
              id="p2"
              type="text"
              value={partnerTwo}
              onChange={(e) => setPartnerTwo(e.target.value)}
              placeholder="Daniel"
            />
          </div>
          <div className="field">
            <label htmlFor="date">Wedding date</label>
            <input
              id="date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="venue">Venue (if you have one)</label>
            <input
              id="venue"
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Wildflower Barn"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <Button
            type="submit"
            disabled={busy || !partnerOne.trim()}
            style={{ width: "100%" }}
          >
            {busy ? "Setting up…" : "Start planning"}
          </Button>
        </form>
      </div>
    </main>
  );
}
