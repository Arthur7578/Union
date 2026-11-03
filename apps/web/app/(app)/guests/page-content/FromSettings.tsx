"use client";

import Link from "next/link";
import type { Wedding } from "@union/shared";
import { T } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";

export type KnownFacts = {
  /** The primary RSVP form's closing date, if any, and where to edit it. */
  rsvpClosesAt: string | null;
  rsvpFormHref: string;
  staysCount: number;
};

/**
 * What the guest page already takes from elsewhere in the app, shown with its
 * source and a link to where it lives, so the couple never types it twice.
 */
export function FromSettings({
  wedding,
  facts,
  locale,
}: {
  wedding: Wedding;
  facts: KnownFacts;
  locale: string;
}) {
  const t = useT().guests.pageContent;
  const date = (iso: string | null) =>
    iso
      ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
  const names = [wedding.partner_one, wedding.partner_two].filter(Boolean).join(" & ");
  const city = [wedding.address_postal_code, wedding.address_city].filter(Boolean).join(" ");
  const address = [wedding.address_line, city, wedding.address_country].filter(Boolean).join(", ");

  const rows: Array<{ label: string; value: string | null; from: string; href: string }> = [
    { label: t.names, value: names || null, from: t.fromWedding, href: "/account/wedding" },
    { label: t.date, value: date(wedding.event_date), from: t.fromWedding, href: "/account/wedding" },
    { label: t.venue, value: wedding.venue_name, from: t.fromWedding, href: "/account/wedding" },
    { label: t.address, value: address || wedding.venue_address, from: t.fromWedding, href: "/account/wedding" },
    {
      label: t.deadline,
      value: date(facts.rsvpClosesAt) ?? t.noDeadline,
      from: t.fromRsvp,
      href: facts.rsvpFormHref,
    },
    { label: t.stays, value: t.staysCount(facts.staysCount), from: t.fromStays, href: "/guests/stays" },
  ];

  return (
    <section
      aria-labelledby="from-settings-h"
      style={{
        background: T.greenBg,
        borderRadius: 18,
        padding: "14px 16px 6px",
        marginBottom: 18,
      }}
    >
      <h2 id="from-settings-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>
        {t.fromSettingsTitle}
      </h2>
      <p style={{ margin: "3px 0 10px", fontSize: 13, color: T.muted }}>{t.fromSettingsLead}</p>
      <dl style={{ margin: 0 }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: "0 12px",
              alignItems: "baseline",
              padding: "8px 0",
              borderTop: `1px solid ${T.line2}`,
            }}
          >
            <dt style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{row.label}</dt>
            <dd style={{ margin: 0, gridColumn: 1, fontSize: 13, color: row.value ? T.ink2 : T.faint }}>
              {row.value ?? t.notSet} <span style={{ color: T.faint }}>· {row.from}</span>
            </dd>
            <Link
              href={row.href}
              style={{ gridRow: "1 / span 2", gridColumn: 2, fontSize: 13, color: T.accentInk, minHeight: 44, display: "inline-flex", alignItems: "center" }}
              aria-label={`${t.edit} · ${row.label}`}
            >
              {t.edit} ›
            </Link>
          </div>
        ))}
      </dl>
    </section>
  );
}
