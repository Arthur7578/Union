"use client";

import { useState } from "react";
import { rsvpAnswers, type AnsweredRsvpStatus, type CalendarMoment } from "@union/shared";
import { useLocale } from "@/lib/i18n/client";
import type { RsvpStatus } from "@/lib/submitRsvp";
import { CalendarSheet } from "./CalendarSheet";
import { FormList, type FormItem } from "./FormList";
import { dayLabel, shortDate } from "@/lib/dateLabels";
import { SectionHead } from "./SectionHead";

export type RsvpWindow = "hidden" | "scheduled" | "live" | "closed";

/**
 * Ta réponse: the RSVP card at the end of the page, then the couple's other
 * forms. A box on the card opens the RSVP form already answered, on the
 * question that follows. Once replied, the card says so and offers to change
 * the reply while replies are open; a guest who is coming is also offered the
 * weekend in their calendar and the carpool board, when the page has them.
 */
export function ReplySection({
  window: rsvpWindow,
  status,
  title,
  summary,
  labels,
  allowMaybe,
  opensAt,
  closesAt,
  onAnswer,
  onEdit,
  otherForms,
  weekend = [],
  calendarName = "",
  coupleNames = "",
  onCarpool,
}: {
  window: RsvpWindow;
  status: RsvpStatus;
  /** The RSVP's title, in the couple's words, as the form says it. */
  title: string;
  /** Before a reply, the RSVP's subtitle; after, the guest's answer in one
   *  line (no name when invited alone, one name per person for a household:
   *  see rsvpCardLine, #85). */
  summary: string;
  labels: Record<AnsweredRsvpStatus, string>;
  allowMaybe: boolean;
  opensAt: string | null | undefined;
  closesAt: string | null | undefined;
  onAnswer: (answer: AnsweredRsvpStatus) => void;
  onEdit: () => void;
  /** The final check-in and the couple's own forms. */
  otherForms: FormItem[];
  /** The weekend's moments as calendar events, when the page shows them. */
  weekend?: CalendarMoment[];
  calendarName?: string;
  /** Who to tell, once replies are closed. */
  coupleNames?: string;
  /** Goes to the carpool board, when the page shows it. */
  onCarpool?: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.weddingPage;
  const deadline = shortDate(closesAt, locale);
  const opens = shortDate(opensAt, locale);
  const replied = status !== "pending";
  const live = rsvpWindow === "live";
  const [sheetOpen, setSheetOpen] = useState(false);
  const coming = status === "attending";
  const shortcuts = coming && (weekend.length > 0 || Boolean(onCarpool));

  return (
    <>
      <SectionHead title={replied ? copy.replyReceived : copy.replyTitle} />

      {rsvpWindow !== "hidden" ? (
        <div className="wp-card-wrap">
          <article className={`wp-card${replied ? " is-replied" : ""}`} aria-labelledby="wp-card-title">
            <h3 id="wp-card-title" className="wp-card-title">
              {title}
            </h3>
            {!replied ? (
              <>
                <div className="wp-card-head">
                  <p>
                    {rsvpWindow === "closed" && deadline
                      ? copy.repliesClosed(deadline)
                      : rsvpWindow === "scheduled" && opens
                        ? copy.repliesOpen(opens)
                        : deadline
                          ? copy.replyBy(deadline)
                          : copy.replyPlease}
                  </p>
                </div>
                {/* The couple's subtitle asks for a reply: only while one can
                    be given. Once closed, what to do instead. */}
                {live && summary ? <p className="wp-card-sub">{summary}</p> : null}
                {rsvpWindow === "closed" && coupleNames ? (
                  <p className="wp-card-sub">{copy.closedHelp(coupleNames)}</p>
                ) : null}
                {live ? (
                  <div className="wp-opts">
                    {rsvpAnswers(allowMaybe).map((answer) => (
                      <button key={answer} type="button" className="wp-opt" onClick={() => onAnswer(answer)}>
                        {labels[answer]}
                      </button>
                    ))}
                  </div>
                ) : null}
                {live && deadline ? <p className="wp-card-note">{copy.editUntil(deadline)}</p> : null}
              </>
            ) : (
              <>
                <div className="wp-card-head">
                  <p className="wp-card-thanks">{copy.thanks}</p>
                  <p>
                    {status === "attending"
                      ? copy.thanksBody
                      : status === "maybe"
                        ? copy.thanksMaybe
                        : copy.thanksDeclined}
                  </p>
                  <span className="wp-stamp" aria-hidden="true">
                    {copy.received}
                  </span>
                </div>
                <p className="wp-summary">{summary}</p>
                {shortcuts ? (
                  <div className="wp-shortcuts">
                    {weekend.length ? (
                      <button type="button" className="gh-btn" onClick={() => setSheetOpen(true)}>
                        {copy.addWeekend}
                      </button>
                    ) : null}
                    {onCarpool ? (
                      <button type="button" className="gh-btn gh-btn--ghost" onClick={onCarpool}>
                        {copy.findCarpool}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {live ? (
                  <div className="wp-actions">
                    <button type="button" className="gh-btn gh-btn--ghost" onClick={onEdit}>
                      {copy.editReply}
                    </button>
                  </div>
                ) : null}
                {live && deadline ? <p className="wp-card-note">{copy.editUntil(deadline)}</p> : null}
              </>
            )}
          </article>
        </div>
      ) : null}

      {sheetOpen ? (
        <CalendarSheet
          moments={weekend}
          calendarName={calendarName}
          labelOf={(m) => [dayLabel(m.date, locale), m.startsAt].filter(Boolean).join(", ")}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {otherForms.length ? (
        <>
          <h3 className="wp-small">{copy.otherForms}</h3>
          <FormList items={otherForms} />
        </>
      ) : null}
    </>
  );
}
