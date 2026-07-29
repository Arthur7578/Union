// English is the source of truth. Every other locale is typed against
// `Dictionary = typeof en`, so `npm run typecheck` fails if a key is
// added here without a corresponding translation elsewhere — that's how
// French stays in lockstep with the app as it evolves.

export const en = {
  // Language display + switcher
  lang: {
    en: "English",
    fr: "Français",
    switchTo: "Language",
  },

  // Common actions and states
  common: {
    loading: "Loading…",
    oneMoment: "One moment…",
    back: "Back",
    backHome: "← Back to home",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    retry: "Try again",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    open: "Open",
    close: "Close",
    signOut: "Sign out",
    signIn: "Sign in",
    signingOut: "Signing out…",
    yes: "Yes",
    no: "No",
    error: "Something went wrong.",
    sample: "Sample",
    demo: "Demo data",
    demoNotice:
      "This screen shows sample content — not your real wedding data. It's a preview of a feature that isn't wired to the backend yet.",
  },

  // Landing page
  landing: {
    kicker: "The AI wedding negotiator",
    tagline:
      "The AI that doesn't just help you plan the wedding — it negotiates with vendors, closes the deals, and keeps everything calmly under control.",
    getStarted: "Get started",
    signIn: "Sign in",
    openUnion: "Open Union →",
    rsvpHint: "Here to RSVP? Use the personal invitation link the couple sent you.",
  },

  // Sign-in flow
  signIn: {
    title: "Union",
    subEmail: "Sign in with your email — we'll send you an 8-digit code.",
    subCode: (email: string) => `Enter the 8-digit code we sent to ${email}.`,
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    codeLabel: "8-digit code",
    codePlaceholder: "12345678",
    sending: "Sending…",
    sendCode: "Email me a code",
    verifying: "Verifying…",
    submit: "Sign in",
    useDifferentEmail: "Use a different email",
    resend: "Resend code",
    errSend: "Couldn't send the code.",
    errVerify: "That code didn't work — try again.",
    errSignOut: "Couldn't sign you out.",
    checking: "Checking your sign-in…",
    alreadyTitle: "You're already signed in",
    alreadySubWithEmail: (email: string) =>
      `Signed in as ${email}. Head into Union — or sign out to use a different email.`,
    alreadySubNoEmail:
      "You're signed in. Head into Union — or sign out to use a different email.",
    continue: "Continue to Union",
    signOutAndSwitch: "Sign out and use a different email",
  },

  // Onboarding
  onboarding: {
    title: "Let's set up your wedding",
    sub: "Just the basics — you can change any of this later.",
    yourName: "Your name",
    partnerName: "Partner's name",
    weddingDate: "Wedding date",
    venue: "Venue (if you have one)",
    saving: "Setting up…",
    submit: "Start planning",
    errSave: "Couldn't save. Try again.",
    yourNamePlaceholder: "Maya",
    partnerNamePlaceholder: "Daniel",
    venuePlaceholder: "Wildflower Barn",
  },

  // Today page
  today: {
    goodMorning: (name: string) => `Good morning, ${name}.`,
    onTrack: "On track",
    daysToGo: "days to go",
    setYourDate: "set your date",
    dateTBD: "Date to be set",
    handlingLead: {
      before: "Union is handling",
      strong: "three things",
      after: "for you right now. Nothing needs to worry you today — except one happy decision.",
    },
    needsYou: "Needs you today",
    approveFlorist: "Approve the florist's final quote",
    floristBody: {
      before: "Union negotiated The Wild Stem down to",
      priceHighlight: "$3,300",
      middle: " — ",
      savings: "$540 under",
      end: " your florals budget, same garden-style arrangements you loved.",
    },
    approve: "Approve",
    review: "Review",
    yourGuests: "Your guests",
    guestStatsComing: "Coming",
    guestStatsWaiting: "Waiting",
    guestStatsCant: "Can't",
    guestStatsSummary: (parties: number, invited: number) =>
      `${parties} parties · ${invited} invited`,
    openGuests: "Open guests →",
    unionHandling: "Union is handling",
    justClosed: "Just closed",
    venueDepositPaid: "Venue deposit paid — it's yours",
    venueDepositMeta: (venue: string, name: string) =>
      `${venue} · approved by ${name} · 2 days ago`,
    openingUnion: "Opening Union…",
  },

  // Bottom tab / sidebar labels
  nav: {
    today: "Today",
    vendors: "Vendors",
    union: "Union",
    guests: "Guests",
    plan: "Plan",
  },

  // Guests
  guests: {
    title: "Guests",
    kicker: "Your list",
    subtitle: (invited: number, coming: number) =>
      `${invited} invited · ${coming} coming`,
    add: "Add a guest",
    empty: "No guests yet — add your first invitation.",
    filterAll: "All",
    filterComing: "Coming",
    filterWaiting: "Waiting",
    filterCant: "Can't come",
    inviteLink: "Personal invite link",
    copyLink: "Copy link",
    linkCopied: "Copied!",
    status: {
      pending: "Waiting",
      accepted: "Coming",
      declined: "Can't come",
    },
    numAttending: (n: number) =>
      n === 1 ? "1 attending" : `${n} attending`,
    detailsTitle: "Guest details",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    notes: "Notes",
    plusOnes: "Plus-ones",
    dietary: "Dietary notes",
    message: "Message",
    saveGuest: "Save guest",
    removeGuest: "Remove guest",
    confirmRemove: "Remove this guest? This can't be undone.",
    invitedOn: "Invited on",
    respondedOn: "Responded on",
  },

  // Vendors
  vendors: {
    title: "Vendors",
    kicker: "Your board",
    addVendor: "Add a vendor",
    searchTitle: "Set a search in motion",
    searchInProgress: "Search in progress",
    negotiation: "Negotiation",
    newVendor: "New vendor",
  },

  // Plan
  plan: {
    title: "Plan",
    kicker: "What's next",
    budget: "Budget",
    weekend: "The weekend",
    team: "Plan together",
  },

  // Settings (available via sign out area / profile)
  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "Choose the language for the Union app.",
    account: "Account",
    signOut: "Sign out",
  },

  // Public RSVP flow
  rsvp: {
    invalidTitle: "Invitation not found",
    invalidBody:
      "This link is missing or no longer valid. Check with the couple for a fresh invite.",
    joinPrompt: (couple: string) => `${couple} would love to have you.`,
    dateAt: (date: string, venue: string) => `${date} · ${venue}`,
    accept: "Yes, I'll be there",
    decline: "Sadly, I can't make it",
    numAttendingLabel: "How many in your party?",
    dietaryLabel: "Any dietary notes?",
    dietaryPlaceholder: "Vegetarian, gluten-free, allergies…",
    messageLabel: "A note for the couple (optional)",
    messagePlaceholder: "Can't wait to celebrate with you!",
    submit: "Send my reply",
    submitting: "Sending…",
    thanksAccept: (couple: string) =>
      `Thank you! ${couple} have been notified you're coming.`,
    thanksDecline: (couple: string) =>
      `Your reply has been sent. ${couple} will miss you.`,
    update: "Update my reply",
  },

  // Errors and misc
  offline: {
    title: "You're offline",
    body: "Union will reconnect the moment you're back online.",
  },
  configNotice: {
    title: "Union isn't configured yet",
    body:
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then reload.",
  },
};

// Widening `typeof en` to a Dictionary type keeps every key + function
// signature in the shape, but relaxes the value type from a specific string
// literal (like "Sign in") down to `string`. Otherwise the FR file would
// have to write the exact same English literals — the whole point of the
// typed-dictionaries setup is to enforce shape parity, not literal parity.
export type Dictionary = typeof en;
