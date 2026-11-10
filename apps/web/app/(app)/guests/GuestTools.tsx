"use client";

import React from "react";
import Link from "next/link";
import { T } from "@/lib/theme";
import { ChevronRight } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type Tool = { href: string; label: string; sub: string };
type Stage = { id: string; title: string; tools: Tool[] };

/**
 * Every guest tool, ordered the way a couple meets them: who is invited,
 * what the invitation says, how it goes out, then the day itself.
 */
export function guestStages(t: Dictionary, guestCount: number | null): Stage[] {
  const tools = t.guests.tools;
  return [
    {
      id: "invited",
      title: t.guests.hub.stageInvited,
      tools: [
        {
          href: "/guests/list",
          label: t.guests.guestList,
          sub: guestCount === null ? "" : t.guests.hub.listSub(guestCount),
        },
        { href: "/guests/groups", label: tools.groupsLabel, sub: tools.groupsSub },
        { href: "/guests/duplicates", label: tools.duplicatesLabel, sub: tools.duplicatesSub },
      ],
    },
    {
      id: "invitation",
      title: t.guests.hub.stageInvitation,
      tools: [
        { href: "/guests/page-content", label: tools.pageContentLabel, sub: tools.pageContentSub },
        { href: "/guests/forms", label: tools.formsLabel, sub: tools.formsSub },
        { href: "/guests/modules", label: tools.modulesLabel, sub: tools.modulesSub },
        { href: "/guests/permissions", label: tools.permissionsLabel, sub: tools.permissionsSub },
      ],
    },
    {
      id: "sending",
      title: t.guests.hub.stageSending,
      tools: [
        { href: "/guests/group-link", label: tools.groupLinkLabel, sub: tools.groupLinkSub },
        { href: "/guests/sms-template", label: tools.smsTemplateLabel, sub: tools.smsTemplateSub },
      ],
    },
    {
      id: "day",
      title: t.guests.hub.stageDay,
      tools: [
        { href: "/guests/seating", label: tools.seatingLabel, sub: tools.seatingSub },
        { href: "/guests/stays", label: tools.staysLabel, sub: tools.staysSub },
      ],
    },
  ];
}

export function GuestTools({ stages }: { stages: Stage[] }) {
  return (
    <div className="gu-stages">
      {stages.map((stage) => (
        <section key={stage.id} aria-labelledby={`gu-stage-${stage.id}`}>
          <h2 id={`gu-stage-${stage.id}`} className="u-serif gu-h2">
            {stage.title}
          </h2>
          <ul role="list" className="gu-group">
            {stage.tools.map((tool) => (
              <li key={tool.href}>
                <Link href={tool.href} className="gu-row">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 15, color: T.ink }}>
                      {tool.label}
                    </span>
                    {tool.sub && (
                      <span style={{ display: "block", fontSize: 12.5, color: T.muted, marginTop: 1 }}>
                        {tool.sub}
                      </span>
                    )}
                  </span>
                  <ChevronRight />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
