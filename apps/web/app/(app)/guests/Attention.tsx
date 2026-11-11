"use client";

import React from "react";
import Link from "next/link";
import type { AttentionItem } from "@union/shared";
import { EnvelopeIcon, GuestsIcon, LinkIcon, QuestionIcon, TableIcon } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { useRsvpNudge } from "./useGuests";

type Nudge = ReturnType<typeof useRsvpNudge>;

/**
 * The root of the Guests hub: what needs the couple, most pressing first,
 * one card per point with one action. Only the first pressing card gets the
 * filled button; the rest are ghost buttons or links.
 */
export function AttentionList({
  items,
  nudge,
  headcount,
  t,
}: {
  items: AttentionItem[];
  nudge: Nudge;
  headcount: { firm: number; ceiling: number };
  t: Dictionary;
}) {
  if (items.length === 0) {
    return (
      <div className="ds-task">
        <span aria-hidden className="ds-task-icon is-calm">
          <GuestsIcon size={20} stroke="currentColor" />
        </span>
        <div>
          <p className="ds-task-title">{t.guests.hub.allClear}</p>
          <p className="ds-task-body">{t.guests.hub.allClearBody}</p>
        </div>
      </div>
    );
  }
  return (
    <ul role="list" className="ds-tasks">
      {items.map((item, index) => (
        <li key={item.kind}>
          <Task item={item} primary={index === 0} nudge={nudge} headcount={headcount} t={t} />
        </li>
      ))}
    </ul>
  );
}

function Task({
  item,
  primary,
  nudge,
  headcount,
  t,
}: {
  item: AttentionItem;
  primary: boolean;
  nudge: Nudge;
  headcount: { firm: number; ceiling: number };
  t: Dictionary;
}) {
  const h = t.guests.hub;
  const btn = primary ? "ds-btn is-small" : "ds-btn is-ghost is-small";
  switch (item.kind) {
    case "nudge": {
      const calm = item.recentDays !== null;
      return (
        <Card icon={<EnvelopeIcon size={20} stroke="currentColor" />} calm={calm} title={h.nudgeTitle(item.waiting)}>
          <p className="ds-task-body">
            {calm ? h.nudgeRecent(item.recentDays!) : h.nudgeBody(item.withEmail)}
          </p>
          {nudge.opened ? (
            // Manual mode: the mail app opened, Union can't know if it was
            // sent. Noting it is the couple's choice, never automatic.
            <div className="ds-task-actions" role="group" aria-label={h.nudgeConfirm}>
              <p className="ds-task-body" style={{ margin: 0, flexBasis: "100%" }}>
                {h.nudgeConfirm}
              </p>
              <button type="button" className="ds-btn is-small" onClick={nudge.confirm} disabled={nudge.busy}>
                {h.nudgeConfirmYes}
              </button>
              <button type="button" className="ds-link" onClick={nudge.dismiss}>
                {h.nudgeConfirmNo}
              </button>
            </div>
          ) : (
            nudge.mailto && (
              <div className="ds-task-actions">
                <a href={nudge.mailto} onClick={nudge.onOpen} className={calm ? "ds-btn is-ghost is-small" : btn}>
                  {calm ? h.nudgeAgain : h.nudgeButton(item.withEmail)}
                </a>
              </div>
            )
          )}
          {nudge.note && (
            <p role="status" className="ds-task-body">
              {nudge.note}
            </p>
          )}
        </Card>
      );
    }
    case "noEmail":
      return (
        <Card icon={<LinkIcon size={20} stroke="currentColor" />} title={h.noEmailTitle(item.count)}>
          <p className="ds-task-body">{h.noEmailBody(item.count)}</p>
          <div className="ds-task-actions">
            <Link href="/guests/list?status=waiting&email=missing" className={btn}>
              {h.seeThem}
            </Link>
          </div>
        </Card>
      );
    case "duplicates":
      return (
        <Card icon={<GuestsIcon size={20} stroke="currentColor" />} title={h.duplicatesTitle(item.count)}>
          <p className="ds-task-body">{h.duplicatesBody}</p>
          <div className="ds-task-actions">
            <Link href="/guests/duplicates" className={btn}>
              {h.review}
            </Link>
          </div>
        </Card>
      );
    case "unseated":
      return (
        <Card icon={<TableIcon size={20} stroke="currentColor" />} title={h.unseatedTitle(item.count)}>
          <p className="ds-task-body">{h.unseatedBody}</p>
          <div className="ds-task-actions">
            <Link href="/guests/seating" className={btn}>
              {h.openSeating}
            </Link>
          </div>
        </Card>
      );
    case "maybe":
      return (
        <Card icon={<QuestionIcon size={20} stroke="currentColor" />} calm title={h.maybeTitle(item.count)}>
          <p className="ds-task-body">{t.guests.headcountRange(headcount.firm, headcount.ceiling)}</p>
          <div className="ds-task-actions">
            <Link href="/guests/list?status=maybe" className="ds-link">
              {h.seeThem}
            </Link>
          </div>
        </Card>
      );
  }
}

function Card({
  icon,
  title,
  calm,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  calm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="ds-task">
      <span aria-hidden className={calm ? "ds-task-icon is-calm" : "ds-task-icon"}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 className="ds-task-title">{title}</h3>
        {children}
      </div>
    </article>
  );
}
