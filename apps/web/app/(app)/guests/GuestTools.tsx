"use client";

import React from "react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type Tool = { href: string; label: string; meta?: string; alert?: boolean };
type Stage = { id: string; title: string; tools: Tool[] };

/**
 * Every guest module, ordered the way a couple meets them: who is invited,
 * what the invitation says, how it goes out, then the day itself. Counts
 * show where they help (how many guests, what is left to check).
 */
export function guestStages(
  t: Dictionary,
  counts: { guests: number | null; duplicates: number; unseated: number },
): Stage[] {
  const tools = t.guests.tools;
  const h = t.guests.hub;
  return [
    {
      id: "invited",
      title: h.stageInvited,
      tools: [
        {
          href: "/guests/list",
          label: t.guests.guestList,
          meta: counts.guests === null ? undefined : h.listSub(counts.guests),
        },
        { href: "/guests/groups", label: tools.groupsLabel },
        {
          href: "/guests/duplicates",
          label: tools.duplicatesLabel,
          meta: counts.duplicates > 0 ? h.duplicatesMeta(counts.duplicates) : undefined,
          alert: counts.duplicates > 0,
        },
      ],
    },
    {
      id: "invitation",
      title: h.stageInvitation,
      tools: [
        { href: "/guests/page-content", label: tools.pageContentLabel },
        { href: "/guests/forms", label: tools.formsLabel },
        { href: "/guests/modules", label: tools.modulesLabel },
        { href: "/guests/permissions", label: tools.permissionsLabel },
      ],
    },
    {
      id: "sending",
      title: h.stageSending,
      tools: [
        { href: "/guests/group-link", label: tools.groupLinkLabel },
        { href: "/guests/sms-template", label: tools.smsTemplateLabel },
      ],
    },
    {
      id: "day",
      title: h.stageDay,
      tools: [
        {
          href: "/guests/seating",
          label: tools.seatingLabel,
          meta: counts.unseated > 0 ? h.unseatedMeta(counts.unseated) : undefined,
          alert: counts.unseated > 0,
        },
        { href: "/guests/stays", label: tools.staysLabel },
      ],
    },
  ];
}

/** The modules as compact tiles, grouped by stage. */
export function GuestTools({ stages }: { stages: Stage[] }) {
  return (
    <div>
      {stages.map((stage) => (
        <section key={stage.id} aria-labelledby={`ds-stage-${stage.id}`}>
          <h3 id={`ds-stage-${stage.id}`} className="ds-tiles-label">
            {stage.title}
          </h3>
          <ul role="list" className="ds-tiles">
            {stage.tools.map((tool) => (
              <li key={tool.href}>
                <Link href={tool.href} className="ds-tile">
                  <span className="ds-tile-label">{tool.label}</span>
                  {tool.meta && (
                    <span className={tool.alert ? "ds-tile-meta is-alert" : "ds-tile-meta"}>{tool.meta}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
