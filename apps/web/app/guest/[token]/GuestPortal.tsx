"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EMPTY_GUEST_PAGE,
  canAddChildren,
  canAddPartner as mayAddPartner,
  mayAttend,
  normalizeQuestions,
  rsvpCardLine,
} from "@union/shared";
import type { AnsweredRsvpStatus, FormAnswers, GuestModuleKey } from "@union/shared";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useReplayWelcome, useWelcomeContinues, useWelcomeResponses } from "@/components/guest/WelcomeGate";
import { formatGuestAddress } from "@/lib/guestAddress";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { coupleText, coupleTextOr, rsvpDefaults, rsvpWording } from "@/lib/i18n/text";
import { takeRsvpHandoff } from "@/lib/rsvpHandoff";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { GUEST_DA_VARS } from "@/lib/theme";
import { CustomFormFlow, type Respondent } from "./CustomFormFlow";
import { DressSection } from "./DressSection";
import { FaqSection } from "./FaqSection";
import { type FormItem } from "./FormList";
import { ReplyDock } from "./ReplyDock";
import { ReplySection } from "./ReplySection";
import { VenueSection } from "./VenueSection";
import { WeekendSection, calendarMoments } from "./WeekendSection";
import { WordSection } from "./WordSection";
import { useReplyEmail } from "./ReplyEmailField";
import { RsvpFlow, type RsvpAnswers, type RsvpReply } from "./RsvpFlow";
import { TravelSection } from "./TravelSection";
import type { DBInvitation } from "./page";
import { useActiveSection, useDaysLeft, useInView } from "./pageHooks";
import { shownParts } from "./pageParts";
import "./GuestPortal.css";
import "./WeddingPage.css";

interface GuestPortalProps {
  token: string;
  invitation: DBInvitation;
  isDemo: boolean;
  /** The couple has no email for this guest: ask for one when they reply. */
  emailMissing?: boolean;
  /** The organiser's "see as a guest" preview: a band says so, with the way out. */
  preview?: boolean;
}

type CustomForm = NonNullable<DBInvitation["custom_forms"]>[number];

export function GuestPortal({ token, invitation, isDemo, emailMissing = false, preview = false }: GuestPortalProps) {
  const replayWelcome = useReplayWelcome();
  const { t, locale } = useLocale();
  const hub = t.guestHub;
  const page = t.weddingPage;
  const router = useRouter();
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const addressText = formatGuestAddress(invitation.wedding);
  const guestPage = invitation.guest_page ?? EMPTY_GUEST_PAGE;

  // The parts the couple left on and wrote something in; the reply comes
  // last, always.
  const parts = shownParts(invitation);
  type PageSection = GuestModuleKey | "reply";
  const sectionId = (key: PageSection) => `gh-${key}`;

  // Which form is open, full screen: the RSVP (its first ask, or the later
  // reconfirmation nudge — same answers, only the framing differs) or one of
  // the couple's own forms.
  const [rsvpOpen, setRsvpOpen] = useState<"primary" | "reconfirmation" | null>(null);
  // Opened straight from "Respond to the invitation": the faire-part was the
  // introduction, so the form starts at its first question.
  const [rsvpFromWelcome, setRsvpFromWelcome] = useState(false);
  // Answered on the page's RSVP card: the form opens on what follows.
  const [rsvpAnswer, setRsvpAnswer] = useState<AnsweredRsvpStatus | undefined>(undefined);
  const openRsvp = (context: "primary" | "reconfirmation", answer?: AnsweredRsvpStatus) => {
    setRsvpFromWelcome(false);
    setRsvpAnswer(answer);
    setRsvpOpen(context);
  };
  const [openFormId, setOpenFormId] = useState<string | null>(null);

  // The guest's reply as last saved, so the hub shows it without a reload.
  const [reply, setReply] = useState<RsvpReply>(() => ({
    status: invitation.guest.rsvp_status,
    companions: Object.fromEntries(invitation.companions.map((c) => [c.id, { rsvp_status: c.rsvp_status }])),
  }));
  // Answers to each RSVP form's questions (the first ask and the final
  // check-in ask their own), per person, as last saved — so reopening a form
  // starts from what was sent, not from blank fields that would overwrite it.
  const [rsvpAnswers, setRsvpAnswers] = useState<Record<string, RsvpAnswers>>(() => {
    const byForm: Record<string, RsvpAnswers> = {};
    for (const form of [invitation.rsvp_form, invitation.rsvp_reconfirmation]) {
      if (!form?.id) continue;
      byForm[form.id] = { ...(form.companion_answers ?? {}), [invitation.guest.id]: form.answers ?? {} };
    }
    return byForm;
  });

  // Companions — local state (not just the invitation prop) so a partner or
  // child added mid-RSVP shows up at once.
  const [companions, setCompanions] = useState(invitation.companions);
  const [kidsRemaining, setKidsRemaining] = useState<number | null>(invitation.permissions.kids_remaining);

  // get_invitation hands back whatever jsonb holds, which for a form written
  // before the localization migration is bare-string titles and options. Fold
  // those into the localized shape here, once, so nothing downstream has to
  // care which era a form was authored in.
  const [customForms, setCustomForms] = useState(() =>
    (invitation.custom_forms ?? []).map((f) => ({
      ...f,
      questions: normalizeQuestions(f.questions, DEFAULT_LOCALE),
    })),
  );

  // "Respond to the invitation" — on the faire-part, or on the group link
  // before being sent here — goes straight into the RSVP when there is one to
  // answer. A guest who has already replied lands on the hub, their answer on
  // show; so does anyone opening the link again later (the flag is one-shot).
  const welcomeResponses = useWelcomeResponses();
  // The RSVP follows the same published + opens/closes window as any other
  // form: its answers are saved through the form, which refuses them outside
  // it. Unpublished, it isn't shown at all.
  const primaryForm = invitation.rsvp_form ?? null;
  const rsvpWindow: "hidden" | "scheduled" | "live" | "closed" = (() => {
    if (primaryForm?.published === false) return "hidden";
    const at = new Date();
    if (primaryForm?.opens_at && new Date(primaryForm.opens_at) > at) return "scheduled";
    if (primaryForm?.closes_at && new Date(primaryForm.closes_at) < at) return "closed";
    return "live";
  })();
  const rsvpLive = rsvpWindow === "live";
  const answerNow = reply.status === "pending" && rsvpLive;
  useEffect(() => {
    // Next frame: the hub paints once, then the form slides in over it. The
    // flag is taken there too, so an effect React runs twice in development
    // (and cancels once) doesn't spend it on the cancelled run.
    const frame = requestAnimationFrame(() => {
      if (!takeRsvpHandoff(token) || !answerNow) return;
      setRsvpFromWelcome(true);
      setRsvpOpen("primary");
    });
    return () => cancelAnimationFrame(frame);
    // Only a new "respond" should open it, not a reply changing answerNow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeResponses, token]);

  const daysLeft = useDaysLeft(invitation.wedding.event_date);
  // A guest the couple has no email for is asked for one as part of the RSVP.
  const replyEmail = useReplyEmail({ token, emailMissing, isDemo });

  useEffect(() => {
    let mounted = true;
    const supabase = getBrowserSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasAuthSession(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasAuthSession(Boolean(session));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // The menu closes on any tap outside it, and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleGuestSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await getBrowserSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.push("/");
    } catch (error) {
      console.error("Failed to sign out guest:", error);
      setSigningOut(false);
    }
  };

  const { partner_one: partnerOne, partner_two: partnerTwo } = invitation.wedding;
  const coupleNames = `${partnerOne} & ${partnerTwo}`;
  const guestFirstName = invitation.guest.first_name;
  const guestFullName = [invitation.guest.first_name, invitation.guest.last_name].filter(Boolean).join(" ");
  const displayDate = invitation.wedding.event_date
    ? new Date(`${invitation.wedding.event_date}T00:00:00`).toLocaleDateString(
        locale === "fr" ? "fr-FR" : "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
      )
    : null;
  const place = invitation.wedding.venue_name || addressText;

  // RSVP wording — the couple's own copy in this guest's language if they've
  // written one, else Union's default copy in that language. Wording is the
  // *only* thing an override can change: which rsvp_status an answer submits
  // is fixed in code.
  const { title: rsvpTitle, subtitle: rsvpSubtitle, labelAttending, labelMaybe, labelDeclined } =
    rsvpWording(invitation.rsvp_form, locale);
  // "Maybe" is the couple's decision. A server that doesn't send the flag (one
  // older than the column) reads as off: the two-answer RSVP guests had before.
  const allowMaybe = invitation.wedding.allow_rsvp_maybe === true;

  // The optional late "still coming?" touchpoint — shown only when the couple
  // has published it and it's within its window.
  const reconfirmation = invitation.rsvp_reconfirmation ?? null;
  const now = new Date();
  const reconfirmationLive =
    !!reconfirmation?.published &&
    (!reconfirmation.opens_at || new Date(reconfirmation.opens_at) <= now) &&
    (!reconfirmation.closes_at || new Date(reconfirmation.closes_at) >= now);
  const reconfirmDefaults = rsvpDefaults(locale, "reconfirmation");
  const reconfirmTitle = coupleTextOr(reconfirmation?.title, locale, reconfirmDefaults.title);
  const reconfirmSubtitle = coupleTextOr(reconfirmation?.subtitle, locale, reconfirmDefaults.subtitle);

  // A custom form's live/scheduled/closed state is the same published +
  // opens_at/closes_at window the admin's formStatus() uses — only published
  // forms ever reach the guest, so there's no "draft" case here.
  const customFormState = (f: CustomForm): "scheduled" | "live" | "closed" => {
    if (f.opens_at && new Date(f.opens_at) > now) return "scheduled";
    if (f.closes_at && new Date(f.closes_at) < now) return "closed";
    return "live";
  };
  /** A custom form's heading in this guest's language, falling back to the
   *  couple's own (untranslated) name for it rather than a blank card. */
  const customFormHeading = (f: CustomForm) => coupleTextOr(f.guest_copy?.title, locale, f.title);
  const openForm = customForms.find((f) => f.id === openFormId) ?? null;

  // A guest may add at most one partner; children only within the wedding's
  // kids budget.
  const canAddPartner = mayAddPartner({
    allowed: invitation.permissions.can_add_partner,
    hasPartner: companions.some((c) => c.relationship === "partner_of"),
  });
  const canAddKids = canAddChildren({ allowed: invitation.permissions.can_add_kids, remaining: kidsRemaining });

  // Everyone a custom form is answered for: just the guest, or — when the
  // couple asks it once per person — them and each relative who is coming.
  const respondentsFor = (f: CustomForm): Respondent[] => {
    const self = { id: invitation.guest.id, name: guestFirstName };
    if (!f.per_person) return [self];
    return [
      self,
      ...companions
        .filter((c) => mayAttend(reply.companions[c.id]?.rsvp_status))
        .map((c) => ({ id: c.id, name: c.first_name })),
    ];
  };
  /** The answers on record for one person of a custom form, if any. */
  const answersOf = (f: CustomForm, personId: string) =>
    personId === invitation.guest.id ? f.answers : (f.companion_answers?.[personId] ?? null);

  // The RSVP form the open flow answers: its questions are the couple's, and
  // the final check-in asks its own.
  const activeRsvpForm = rsvpOpen === "reconfirmation" ? reconfirmation : (invitation.rsvp_form ?? null);
  const activeRsvpFormId = activeRsvpForm?.id || null;


  const scrollTo = (key: PageSection) =>
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: "smooth", block: "start" });

  // The guest's answer in one line: their own answer when invited alone, one
  // name per person for a household ("Arthur : Présent, Guinevere : Absent").
  const replyLine =
    reply.status === "pending"
      ? rsvpSubtitle
      : rsvpCardLine({
          guest: { name: guestFirstName, status: reply.status },
          companions: companions.map((c) => ({
            name: c.first_name,
            status: reply.companions[c.id]?.rsvp_status ?? "pending",
          })),
          label: (status) => ({ attending: labelAttending, maybe: labelMaybe, declined: labelDeclined })[status],
          locale,
        });

  // Under the RSVP card: the final check-in and the couple's own forms.
  const otherForms: FormItem[] = [
    // No record says whether a guest has done the final check-in, so it
    // stays "to do" for as long as the couple keeps it open.
    ...(reconfirmationLive
      ? [
          {
            key: "reconfirmation",
            title: reconfirmTitle,
            meta: reconfirmSubtitle,
            state: "todo" as const,
            onOpen: () => openRsvp("reconfirmation"),
            actionLabel: hub.confirm,
          },
        ]
      : []),
    ...customForms.map((f): FormItem => {
      const open = customFormState(f);
      // Counts replies on record, not filled-in fields: an all-optional form
      // sent back empty is a considered "nothing to declare".
      const people = respondentsFor(f);
      const answered = people.filter((p) => answersOf(f, p.id) != null).length;
      const progress = people.length > 1 && answered > 0 ? hub.answeredFor(answered, people.length) : null;
      return {
        key: f.id,
        title: customFormHeading(f),
        meta:
          progress ??
          coupleText(f.guest_copy?.subtitle, locale) ??
          (f.questions.length ? hub.questions(f.questions.length) : undefined),
        state:
          open === "scheduled" ? "soon" : open === "closed" ? "closed" : answered === people.length ? "done" : "todo",
        onOpen: open === "live" ? () => setOpenFormId(f.id) : undefined,
      };
    }),
  ];

  const showReply = rsvpWindow !== "hidden" || otherForms.length > 0;
  const sections: PageSection[] = [...parts, ...(showReply ? (["reply"] as const) : [])];
  // A bar of one section is a button that goes nowhere: only show it when
  // there's somewhere else to go.
  const showNav = sections.length > 1;
  const activeSection = useActiveSection(sections.map(sectionId));
  const overlayOpen = Boolean(rsvpOpen || openForm);
  // "See the rest" on the faire-part: the card grew into this page's paper,
  // so the guest lands on its first part, which rises onto it.
  const welcomeContinues = useWelcomeContinues();
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!welcomeContinues) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(sectionId(sections[0]))?.scrollIntoView({ block: "start" });
      setArrived(true);
    });
    return () => cancelAnimationFrame(frame);
    // Only a new "see the rest" should move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeContinues]);
  // The chip of the section on screen stays in view in the bar.
  // Above the first part, the bar goes back to its start.
  useEffect(() => {
    if (!activeSection) {
      document.querySelector(".wp-chips")?.scrollTo?.({ left: 0 });
      return;
    }
    document
      .querySelector(`.wp-chips [data-section="${activeSection}"]`)
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeSection]);
  const [replyRef, replyInView] = useInView<HTMLElement>();

  return (
    <div className="gh" style={GUEST_DA_VARS as React.CSSProperties}>
      {/* While a form is open over it, the page behind is out of reach: no
          tabbing into it, nothing read out from it. */}
      <div inert={overlayOpen || undefined} aria-hidden={overlayOpen || undefined}>
        {preview ? (
          <div className="gh-demo wp-preview">
            {t.guests.modules.previewBand}{" "}
            <Link href="/guests/modules">{t.guests.modules.previewClose}</Link>
          </div>
        ) : isDemo ? (
          <div className="gh-demo">{hub.demo}</div>
        ) : null}

        <header className="gh-top">
          <span className="gh-mono" aria-label={coupleNames}>
            {partnerOne?.charAt(0)}
            <i aria-hidden="true" />
            {partnerTwo?.charAt(0)}
          </span>
          <div className="gh-top-actions">
            <LocaleToggle />
            {(replayWelcome || (hasAuthSession && !isDemo)) && (
              <div className="gh-menu" ref={menuRef}>
                <button
                  type="button"
                  className="gh-menu-btn"
                  aria-label={hub.menu}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 9h14M5 15h14" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="gh-menu-pop" role="menu">
                    {replayWelcome && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          replayWelcome();
                        }}
                      >
                        {t.welcome.seeAgain}
                      </button>
                    )}
                    {hasAuthSession && !isDemo && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={signingOut}
                        onClick={() => void handleGuestSignOut()}
                      >
                        {signingOut ? t.common.signingOut : t.common.signOut}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {showNav && (
          <nav className="wp-chips" aria-label={hub.sections}>
            {sections.map((key) => (
              <button
                key={key}
                type="button"
                data-section={sectionId(key)}
                aria-current={activeSection === sectionId(key) ? "true" : undefined}
                onClick={() => scrollTo(key)}
              >
                {page.nav[key]}
              </button>
            ))}
          </nav>
        )}

        <section className="gh-hero">
          <div className="gh-arch">
            <OliveBranch className="gh-branch" />
            <p className="gh-greet">{hub.greeting(guestFirstName)}</p>
            <h1 className="gh-names">
              <span>{partnerOne}</span>
              <span className="gh-amp">&amp;</span>
              <span>{partnerTwo}</span>
            </h1>
            <p className="gh-invite">{hub.inviteLine}</p>
            {displayDate ? <p className="gh-date">{displayDate}</p> : null}
            {place ? <p className="gh-place">{place}</p> : null}
            {/* The countdown belongs to Le mot; without it, it stays here. */}
            {daysLeft && !parts.includes("word") ? <p className="gh-count">{hub.countdown(daysLeft)}</p> : null}
          </div>

          {sections.length ? (
            <button type="button" className="gh-discover" onClick={() => scrollTo(sections[0])}>
              {hub.discover}
              <i aria-hidden="true" />
            </button>
          ) : null}
        </section>

        <main className={`gh-main wp-main${arrived ? " is-arriving" : ""}`}>
          {sections.map((key) => (
            <section
              key={key}
              id={sectionId(key)}
              ref={key === "reply" ? replyRef : undefined}
              className="gh-section"
              aria-label={page.nav[key]}
            >
              {key === "word" && <WordSection content={guestPage} coupleNames={coupleNames} daysLeft={daysLeft} />}
              {key === "weekend" && (
                <WeekendSection
                  content={guestPage}
                  eventDate={invitation.wedding.event_date}
                  venueName={invitation.wedding.venue_name}
                  calendarName={coupleNames}
                />
              )}
              {key === "venue" && (
                <VenueSection venueName={invitation.wedding.venue_name} addressText={addressText} content={guestPage} />
              )}
              {key === "travel" && <TravelSection guestName={guestFullName} />}
              {key === "dress" && <DressSection content={guestPage} />}
              {key === "faq" && <FaqSection content={guestPage} />}
              {key === "reply" && (
                <ReplySection
                  window={rsvpWindow}
                  status={reply.status}
                  title={rsvpTitle}
                  summary={replyLine}
                  labels={{ attending: labelAttending, maybe: labelMaybe, declined: labelDeclined }}
                  allowMaybe={allowMaybe}
                  opensAt={primaryForm?.opens_at}
                  closesAt={primaryForm?.closes_at}
                  onAnswer={(answer) => openRsvp("primary", answer)}
                  onEdit={() => openRsvp("primary")}
                  otherForms={otherForms}
                  weekend={
                    parts.includes("weekend")
                      ? calendarMoments(guestPage, invitation.wedding.event_date, locale, invitation.wedding.venue_name)
                      : []
                  }
                  calendarName={coupleNames}
                  onCarpool={parts.includes("travel") ? () => scrollTo("travel") : undefined}
                />
              )}
            </section>
          ))}

          <footer className="gh-footer">
            <OliveBranch className="gh-branch" />
            <p className="gh-footer-script">{hub.footer}</p>
            <p className="gh-footer-names">{coupleNames}</p>
            {displayDate ? <p className="gh-place">{displayDate}</p> : null}
          </footer>
        </main>

        <ReplyDock
          window={rsvpWindow}
          status={reply.status}
          closesAt={primaryForm?.closes_at}
          away={replyInView}
          onReply={() => openRsvp("primary")}
        />
      </div>

      {rsvpOpen && (
        <RsvpFlow
          skipIntro={rsvpFromWelcome || Boolean(rsvpAnswer)}
          answer={rsvpAnswer}
          token={token}
          isDemo={isDemo}
          formId={activeRsvpFormId}
          questions={normalizeQuestions(activeRsvpForm?.questions, DEFAULT_LOCALE)}
          guestId={invitation.guest.id}
          title={rsvpOpen === "reconfirmation" ? reconfirmTitle : rsvpTitle}
          subtitle={rsvpOpen === "reconfirmation" ? reconfirmSubtitle : rsvpSubtitle}
          labelAttending={labelAttending}
          labelMaybe={labelMaybe}
          labelDeclined={labelDeclined}
          allowMaybe={allowMaybe}
          guestFirstName={guestFirstName}
          coupleNames={coupleNames}
          replyEmail={replyEmail}
          initial={reply}
          initialAnswers={(activeRsvpFormId && rsvpAnswers[activeRsvpFormId]) || {}}
          companions={companions}
          canAddPartner={canAddPartner}
          canAddKids={canAddKids}
          onCompanionAdded={(companion, kind) => {
            setCompanions((prev) => [...prev, companion]);
            if (kind === "child") setKidsRemaining((k) => (k !== null ? Math.max(k - 1, 0) : k));
          }}
          onSaved={(saved, answers) => {
            setReply(saved);
            if (activeRsvpFormId) {
              setRsvpAnswers((prev) => ({ ...prev, [activeRsvpFormId]: { ...prev[activeRsvpFormId], ...answers } }));
            }
          }}
          onClose={() => setRsvpOpen(null)}
        />
      )}

      {openForm && (
        <CustomFormFlow
          token={token}
          isDemo={isDemo}
          formId={openForm.id}
          heading={customFormHeading(openForm)}
          subtitle={coupleText(openForm.guest_copy?.subtitle, locale)}
          questions={openForm.questions}
          guestId={invitation.guest.id}
          respondents={respondentsFor(openForm)}
          initial={Object.fromEntries(respondentsFor(openForm).map((p) => [p.id, answersOf(openForm, p.id) ?? {}]))}
          onSaved={(byPerson: Record<string, FormAnswers>) =>
            setCustomForms((prev) =>
              prev.map((f) => {
                if (f.id !== openForm.id) return f;
                const { [invitation.guest.id]: own, ...relatives } = byPerson;
                return {
                  ...f,
                  answers: own ?? f.answers,
                  companion_answers: { ...(f.companion_answers ?? {}), ...relatives },
                };
              }),
            )
          }
          onClose={() => setOpenFormId(null)}
        />
      )}
    </div>
  );
}
