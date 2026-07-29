// Source of truth. French is typed against `Dictionary = typeof en`, so the
// TypeScript compiler enforces that every key has a French translation —
// `npm run typecheck` fails if the two ever drift apart. That's how French
// stays in lockstep with the mobile app as new strings ship.

export const en = {
  lang: {
    en: "English",
    fr: "Français",
    switchTo: "Language",
    description: "Choose the language for the Union app.",
  },

  common: {
    loading: "Loading…",
    oneMoment: "One moment…",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    signIn: "Sign in",
    signOut: "Sign out",
    signOutConfirm: "Are you sure you want to sign out?",
    signOutTitle: "Sign out",
    couldNotSave: "Could not save",
    error: "Something went wrong.",
    add: "Add",
    invalidDate: "Invalid date",
    invalidDateBody: "Use the format YYYY-MM-DD.",
  },

  signIn: {
    tagline: "Plan your wedding, calmly and in control.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    codeLabel: "8-digit code",
    codePlaceholder: "12345678",
    sendCode: "Email me a code",
    submit: "Sign in",
    resend: "Resend code",
    useDifferentEmail: "Use a different email",
    codeHelper: (email: string) =>
      `We sent an 8-digit code to ${email}. Enter it below to finish signing in.`,
    errEmail: "Please enter your email address.",
    errCodeLength: "Enter the 8-digit code from your email.",
    errSend: "Could not send the code.",
    errVerify: "That code didn't work — try again.",
  },

  onboarding: {
    title: "Let's set the scene",
    subtitle: "A few details so Union can help you plan the big day.",
    partnerOne: "Partner 1",
    partnerOnePlaceholder: "e.g. Alex",
    partnerTwo: "Partner 2",
    partnerTwoPlaceholder: "e.g. Sam",
    weddingDate: "Wedding date (optional)",
    weddingDatePlaceholder: "2026-09-12",
    dateHint: "Format: YYYY-MM-DD",
    venue: "Venue (optional)",
    venuePlaceholder: "e.g. Willow Creek Barn",
    submit: "Start planning",
    errMissingPartners: "Add both partners' names.",
    errDate: "Wedding date must be in YYYY-MM-DD format.",
    errSession: "Your session expired. Please sign in again.",
    errSave: "Could not save. Try again.",
  },

  tabs: {
    home: "Home",
    guests: "Guests",
    settings: "Settings",
  },

  home: {
    dateTBD: "Date to be decided",
    countdownDay: "day to go",
    countdownDays: "days to go",
    rsvpOverview: "RSVP overview",
    attending: "Attending",
    awaiting: "Awaiting",
    declined: "Declined",
    invitedParties: "Invited parties",
    confirmedHeadcount: "Confirmed headcount",
  },

  guests: {
    emptyTitle: "No guests yet",
    emptyBody: "Add your first guest to start tracking RSVPs.",
    addGuest: "Add guest",
    partyOne: "1 guest",
    party: (n: number) => `${n} guests`,
    status: {
      attending: "Attending",
      declined: "Declined",
      pending: "Awaiting reply",
    },
  },

  settings: {
    weddingDetails: "Wedding details",
    partnerOne: "Partner 1",
    partnerTwo: "Partner 2",
    weddingDate: "Wedding date",
    dateHint: "Format: YYYY-MM-DD",
    venue: "Venue",
    venueAddress: "Venue address",
    save: "Save",
    signedInAs: "Signed in as",
    language: "Language",
    languageHint: "Choose the language for the Union app.",
  },
};

// See the web dictionary for why we drop `as const` — string literal types
// would force FR to duplicate the English strings verbatim.
export type Dictionary = typeof en;
