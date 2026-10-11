"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  canAddChildren,
  canAddPartner as mayAddPartner,
  enabledGuestModules,
  normalizeQuestions,
} from "@union/shared";
import type { FormAnswers, GuestModuleKey } from "@union/shared";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useReplayWelcome, useWelcomeResponses } from "@/components/guest/WelcomeGate";
import { formatGuestAddress } from "@/lib/guestAddress";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { coupleText, coupleTextOr, rsvpDefaults } from "@/lib/i18n/text";
import { takeRsvpHandoff } from "@/lib/rsvpHandoff";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { GUEST_DA_VARS } from "@/lib/theme";
import { CustomFormFlow, type Respondent } from "./CustomFormFlow";
import { FaqSection } from "./FaqSection";
import { FormList, type FormItem } from "./FormList";
import { LogisticsSection } from "./LogisticsSection";
import { useReplyEmail } from "./ReplyEmailField";
import { RsvpFlow, type RsvpAnswers, type RsvpReply } from "./RsvpFlow";
import { SectionHead } from "./SectionHead";
import { TravelSection } from "./TravelSection";
import type { DBInvitation } from "./page";
import "./GuestPortal.css";

interface GuestPortalProps {
  token: string;
  invitation: DBInvitation;
  isDemo: boolean;
  /** The couple has no email for this guest: ask for one when they reply. */
  emailMissing?: boolean;
}

type CustomForm = NonNullable<DBInvitation["custom_forms"]>[number];

/** Whole days until the wedding, refreshed every minute; null without a date. */
function useDaysLeft(eventDate: string | null | undefined) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!eventDate) return;
    const target = new Date(`${eventDate}T00:00:00`).getTime();
    const update = () => setDays(Math.max(0, Math.ceil((target - Date.now()) / 86_400_000)));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [eventDate]);
  return days;
}

/** Which section is on screen, for the section bar. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const first = key.split(",").find((id) => seen.get(id));
        setActive(first ?? null);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    key.split(",").forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [key]);
  return active;
}

export function GuestPortal({ token, invitation, isDemo, emailMissing = false }: GuestPortalProps) {
  const replayWelcome = useReplayWelcome();
  const { t, locale } = useLocale();
  const hub = t.guestHub;
  const router = useRouter();
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Which modules this wedding shows. The couple turns them off in
  // /guests/modules; a module they've turned off is never rendered here — not
  // as an empty section, not as a link that opens nothing.
  const modules = enabledGuestModules(invitation.wedding.guest_modules);
  const moduleOn = (key: GuestModuleKey) => modules.includes(key);
  // A bar of one section is a button that goes nowhere: only show it when
  // there's somewhere else to go.
  const showNav = modules.length > 1;
  const sectionId = (key: GuestModuleKey) => `gh-${key}`;
  const activeSection = useActiveSection(modules.map(sectionId));

  // Which form is open, full screen: the RSVP (its first ask, or the later
  // reconfirmation nudge — same answers, only the framing differs) or one of
  // the couple's own forms.
  const [rsvpOpen, setRsvpOpen] = useState<"primary" | "reconfirmation" | null>(null);
  // Opened straight from "Respond to the invitation": the faire-part was the
  // introduction, so the form starts at its first question.
  const [rsvpFromWelcome, setRsvpFromWelcome] = useState(false);
  const openRsvp = (context: "primary" | "reconfirmation") => {
    setRsvpFromWelcome(false);
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
  const answerNow = reply.status === "pending" && moduleOn("forms") && rsvpLive;
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
  const addressText = formatGuestAddress(invitation.wedding);
  const place = invitation.wedding.venue_name || addressText;

  // RSVP wording — the couple's own copy in this guest's language if they've
  // written one, else Union's default copy in that language. Wording is the
  // *only* thing an override can change: which rsvp_status an answer submits
  // is fixed in code.
  const primaryDefaults = rsvpDefaults(locale, "primary");
  const rsvpTitle = coupleTextOr(invitation.rsvp_form?.title, locale, primaryDefaults.title);
  const rsvpSubtitle = coupleTextOr(invitation.rsvp_form?.subtitle, locale, primaryDefaults.subtitle);
  const labelAttending = coupleTextOr(invitation.rsvp_form?.label_attending, locale, primaryDefaults.labelAttending);
  const labelDeclined = coupleTextOr(invitation.rsvp_form?.label_declined, locale, primaryDefaults.labelDeclined);

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
        .filter((c) => reply.companions[c.id]?.rsvp_status === "attending")
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

  const statusLabel = (status: RsvpReply["status"]) =>
    status === "attending" ? labelAttending : status === "declined" ? labelDeclined : hub.statusPending;

  const scrollTo = (key: GuestModuleKey) =>
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: "smooth", block: "start" });

  // The guest's household answer in one line ("Arthur : Présent, Guinevere :
  // Absent"), leaving out anyone who hasn't been answered for yet.
  const householdAnswer = [
    { name: guestFirstName, status: reply.status },
    ...companions.map((c) => ({ name: c.first_name, status: reply.companions[c.id]?.rsvp_status ?? "pending" })),
  ]
    .filter((p) => p.status !== "pending")
    .map((p) => `${p.name}${locale === "fr" ? "\u00a0:" : ":"} ${statusLabel(p.status)}`)
    .join(", ");

  const formItems: FormItem[] = [
    ...(rsvpWindow === "hidden"
      ? []
      : [
          {
            key: "rsvp",
            title: rsvpTitle,
            meta: reply.status === "pending" ? rsvpSubtitle : householdAnswer,
            state:
              rsvpWindow === "scheduled"
                ? ("soon" as const)
                : reply.status !== "pending"
                  ? ("done" as const)
                  : rsvpWindow === "closed"
                    ? ("closed" as const)
                    : ("todo" as const),
            onOpen: rsvpLive ? () => openRsvp("primary") : undefined,
          },
        ]),
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

  return (
    <div className="gh" style={GUEST_DA_VARS as React.CSSProperties}>
      {isDemo && <div className="gh-demo">{hub.demo}</div>}

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

      <section className={`gh-hero${showNav ? " has-nav" : ""}`}>
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
          {daysLeft ? <p className="gh-count">{hub.countdown(daysLeft)}</p> : null}
        </div>

        {moduleOn("forms") && (
          <div className="gh-hero-cta">
            {reply.status === "pending" ? (
              rsvpLive ? (
                <button type="button" className="gh-btn gh-btn--big" onClick={() => openRsvp("primary")}>
                  {hub.respond}
                </button>
              ) : null
            ) : (
              <p className="gh-replied">
                <span className={`gh-replied-status is-${reply.status}`}>
                  {reply.status === "attending" ? hub.coming : hub.notComing}
                </span>
                {rsvpLive ? (
                  <button type="button" className="gh-link" onClick={() => openRsvp("primary")}>
                    {hub.editReply}
                  </button>
                ) : null}
              </p>
            )}
          </div>
        )}

        <button type="button" className="gh-discover" onClick={() => scrollTo(modules[0] ?? "forms")}>
          {hub.discover}
          <i aria-hidden="true" />
        </button>
      </section>

      <main className={`gh-main${showNav ? " has-nav" : ""}`}>
        {modules.map((key) => (
          <section key={key} id={sectionId(key)} className="gh-section" aria-label={hub.nav[key]}>
            {key === "forms" && (
              <>
                <SectionHead title={hub.formsTitle} lead={hub.formsIntro(guestFirstName)} />
                <FormList items={formItems} />
              </>
            )}
            {key === "travel" && <TravelSection guestName={guestFullName} />}
            {key === "logistics" && (
              <LogisticsSection venueName={invitation.wedding.venue_name} addressText={addressText} />
            )}
            {key === "faq" && (
              <FaqSection
                formsLabel={moduleOn("forms") ? hub.nav.forms : null}
                travelLabel={moduleOn("travel") ? hub.nav.travel : null}
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

      {showNav && (
        <nav className="gh-nav" aria-label={hub.sections}>
          {modules.map((key) => (
            <button
              key={key}
              type="button"
              aria-current={activeSection === sectionId(key) ? "true" : undefined}
              onClick={() => scrollTo(key)}
            >
              {hub.nav[key]}
            </button>
          ))}
        </nav>
      )}

      {rsvpOpen && (
        <RsvpFlow
          skipIntro={rsvpFromWelcome}
          token={token}
          isDemo={isDemo}
          formId={activeRsvpFormId}
          questions={normalizeQuestions(activeRsvpForm?.questions, DEFAULT_LOCALE)}
          guestId={invitation.guest.id}
          title={rsvpOpen === "reconfirmation" ? reconfirmTitle : rsvpTitle}
          subtitle={rsvpOpen === "reconfirmation" ? reconfirmSubtitle : rsvpSubtitle}
          labelAttending={labelAttending}
          labelDeclined={labelDeclined}
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
