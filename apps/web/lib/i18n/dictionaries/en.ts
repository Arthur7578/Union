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
    live: "Live",
    demo: "Demo data",
    demoNotice:
      "This screen shows sample content — not your real wedding data. It's a preview of a feature that isn't wired to the backend yet.",
    handle: "Handle",
    invite: "Invite",
    adding: "Adding…",
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
      after:
        "for you right now. Nothing needs to worry you today — except one happy decision.",
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
    kicker: "invited",
    kickerFallback: "Guest list",
    add: "Add a guest",
    addShort: "+ Add",
    empty: "No guests yet — add your first invitation.",
    noGuestsTitle: "No guests yet",
    noGuestsBody: "Add the first person you're inviting to get started.",
    noMatches: "No matching guests.",
    searchPlaceholder: "Search by name, email, group…",
    filterAll: "All",
    filterComing: "Coming",
    filterWaiting: "Waiting",
    filterCant: "Can't",
    loadingList: "Loading your guests…",
    planningTools: "Planning tools",
    tools: {
      groupsLabel: "Groups & roles",
      groupsSub: "Colour-code your list",
      seatingLabel: "Seating",
      seatingSub: "Floor plan & ceremony",
      staysLabel: "Stays & travel",
      staysSub: "Room blocks",
      formsLabel: "Forms",
      formsSub: "RSVP, and any forms you add",
      smsTemplateLabel: "SMS template",
      smsTemplateSub: "Sender + invite copy",
    },
    guestList: "Guest list",
    reminderPromptStrong: (n: number) => `${n} still deciding`,
    reminderPromptLead: "Want me to gently remind the",
    reminderPromptTail: "? I'll open your email with them all.",
    reminderNoEmail: {
      before: "",
      strong: (n: number) => String(n),
      after:
        " guests still haven't RSVP'd. Add an email to nudge them, or copy their invite link from the guest page.",
    },
    sendNudge: "Send a nudge",
    opening: "Opening…",
    reminderSummary: (n: number) =>
      n === 1
        ? "Opened your email app with 1 recipient."
        : `Opened your email app with ${n} recipients.`,
    reminderFail: "Couldn't send reminders.",
    emailSubject: (couple: string) => `A gentle nudge — RSVP for ${couple}`,
    emailBody: {
      hello: "Hi there,",
      lead: "Just a friendly note — we'd love to know if you can join us",
      singleLink: (url: string) => `\nHere's your invitation link: ${url}\n`,
      multipleLinks:
        "\nYour personal invitation link is inside the email we sent — reply to this if you need it again.\n",
      thanks: "Thank you!",
    },
    theCouple: "the couple",

    // Add guest form
    addTitle: "Add a guest",
    addSubtitle: "They'll be added to your list",
    fields: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email (for their invite)",
      phone: "Phone",
      group: "Groups (optional)",
      role: "Role in the wedding (optional)",
      notes: "Notes (private to you)",
    },
    placeholders: {
      firstName: "Priya",
      lastName: "Shah",
      email: "priya@example.com",
      phone: "+1 555 123 4567",
      group: "College friends",
      role: "Maid of honor, officiant…",
      notes: "Plus-one confirmed on the phone, allergic to shellfish…",
    },
    suggestedRoles: [
      "Maid of honor",
      "Best man",
      "Bridesmaid",
      "Groomsman",
      "Officiant",
      "Ring bearer",
      "Flower girl",
      "Witness",
    ] as string[],
    submitAdd: "Add guest",
    errAdd: "Couldn't add. Try again.",
  },

  // Vendors
  vendors: {
    title: "Vendors",
    kicker: "12 vendors",
    sub: "2 booked · Union working 3 · 1 waiting on you",
    addVendor: "Add a vendor",
    filters: {
      all: "All",
      booked: "Booked",
      comparing: "In motion",
      todo: "To do",
    },
    unionQuiet: {
      before: "Union is quietly working on",
      strong: "3 of these",
      after: " right now. You'll only hear from it when a decision is yours.",
    },
    setNewSearch: "Set a new search in motion →",

    // Detail
    isNegotiating: (category: string) => `${category} · Union is negotiating`,
    openedOnYourBehalf: "Union opened on your behalf · Mon 9:12 AM",
    composerPlaceholder: "Ask Union to counter or adjust…",
    agreedLabel: "Agreed",
    agreedBody: {
      before: "Union held your budget and found",
      strong: "$540 in savings",
      after: ". Approve to lock it in and release the deposit.",
    },
    approveDeposit: "Approve & send deposit",

    // Search setup
    searchNewTitle: "New search",
    searchNewSubtitle: "Photographer",
    searchDemoNotice:
      "Sample data — this is a preview of how you'd brief Union on a new search. It isn't connected to your account yet.",
    findPhotographer: "Let's find your photographer.",
    searchNote: {
      lead: "I'll handle the searching, outreach and comparing.",
      strong: "I never book, pay, or commit to anything without your yes",
      trail: " — you'll approve every shortlist and quote.",
    },
    styleYouLove: "Style you love",
    budget: "Budget",
    budgetRange: "$4,000 – $5,000",
    flexible: "flexible",
    unionWillBeat: "Union will try to beat the top of this range.",
    mustHaves: "Must-haves",
    anythingElse: "Anything else?",
    anythingElseDefault:
      "Warm and candid — loves catching real moments over posing. Bonus if they know the Wildflower Barn.",
    startSearch: "Start the search",
    searchMyself: "I'd rather search myself",
    styles: [
      "Documentary",
      "Golden-hour",
      "Editorial",
      "Film / analog",
      "Light & airy",
      "Moody",
    ] as string[],
    stylesDefault: ["Documentary", "Golden-hour"] as string[],
    musts: [
      "Full-day coverage",
      "Second shooter",
      "Engagement shoot",
      "Fine-art prints",
    ] as string[],
    mustsDefault: ["Full-day coverage", "Second shooter"] as string[],

    // Search active
    searchActiveTitle: "Photographer search",
    searchActiveStarted: "Started 2 days ago",
    unionIsOnIt: "Union is on it",
    reachedOut: "reached out",
    replied: "replied",
    finalists: "finalists",
    oneQuickCall: "One quick call",
    searchAsk: {
      before: "The two I love most come in around",
      priceOver: "$5,400",
      middle:
        " — just over your range, but both include a second shooter ",
      italic: "and",
      end: " an album. Want me to stretch the budget, or hold firm at $5,000?",
    },
    stretchBudget: "Stretch to $5,400",
    holdBudget: "Hold at $5,000",
    activity: "Activity",
    browseMyself: "Browse all photographers myself →",

    // New vendor
    addTitle: "Add a vendor",
    addSubtitle: "New to Union",
    addHeadline: "Add a vendor we don't know yet.",
    addNote: {
      before: "Once you add them, they join the",
      strong: "Union directory",
      after:
        ". I can start a conversation on your behalf — and future couples can find them too.",
    },
    vendorName: "Vendor name",
    vendorNameDefault: "Fernwood Film Co.",
    category: "Category",
    categories: [
      "Photography",
      "Video",
      "Florals",
      "Music",
      "Other",
    ] as string[],
    whereBased: "Where they're based",
    whereBasedDefault: "Hudson Valley, NY",
    howToReach: "How to reach them",
    reachWebsiteDefault: "fernwoodfilm.co",
    reachContactPlaceholder: "Email or phone (optional)",
    whyYouLove: "Why you love them",
    whyYouLoveDefault:
      "Shot my sister's wedding on film — unreal with natural light. Not sure they're on any platform yet.",
    addToDirectory:
      "Add to the Union directory so other couples can discover them.",
    addAndReach: "Add & let Union reach out",
    previewOnly: "Preview only — nothing was saved to your account.",
  },

  // Plan
  plan: {
    title: "What's next",
    kicker: "68 days out",
    budget: "Budget",
    weekend: "The weekend",
    team: "Plan together",
    unionOrder:
      "These are ordered by what has the least breathing room. Hand any of them to me.",
    thisWeek: "This week",
    bookSoon: "Book soon · Union suggests",
    later: "Later — I'll remind you",
    ownerYou: "You",
    ownerUnion: "Union",

    // Budget
    budgetTitle: "Budget",
    budgetSubtitle: "Sample figures",
    committedOf: (total: string) => `Committed of ${total}`,
    underCeiling: {
      strong: (amount: string) => `${amount} under`,
      trail: " your ceiling — you have room to breathe.",
    },
    unionSavings: {
      before: "Union found",
      strong: "$1,180 in savings",
      after: " this month through negotiation.",
    },
    byCategory: "By category",
    notePending: "pending",
    notePlanned: "planned",

    // Weekend
    weekendTitle: "The weekend",
    weekendSubtitle: "Sept 19 – 21 · run-of-show",
    days: {
      fri: { code: "FRI", label: "Welcome" },
      sat: { code: "SAT", label: "The day" },
      sun: { code: "SUN", label: "Brunch" },
    },
    weekendNote:
      "Union sends each vendor only their slice of this — arrival time, location, contact — one week out.",

    // Team
    teamTitle: "Plan together",
    teamSubtitle: "Your team · 2",
    inviteHelper: "Invite someone to help",
    inviteBody: "They'll see everything and can act with you.",
    invitePlaceholder: "Email address…",
    whoDidWhat: "Who did what",
    you: "you",
    roles: {
      owner: "Owner",
      partner: "Partner",
      pending: "Pending",
    },
  },

  // Settings
  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "Choose the language for the Union app.",
    account: "Account",
    signOut: "Sign out",
  },

  // Account hub — "You", "Your wedding", app settings, notifications, privacy
  account: {
    kicker: "Account",
    title: "You",
    version: "Union for web · v1.0",

    weddingSection: "Your wedding",
    weddingRowFallback: "Add your date & venue",
    teamRowTitle: "Who's planning",
    teamRowSub: (n: number) => `${n} planning together`,

    plusKicker: "Union Plus",
    plusTitle: "Your planner, fully unlocked",
    plusBody:
      "Unlimited negotiations, all vendor searches, and priority when Union reaches out on your behalf.",
    plusRenews: "Renews Sept 1 · $18/mo",
    managePlan: "Manage plan",

    accountSection: "Account",
    billing: "Payment & billing",
    settingsRow: "Settings",
    notificationsRow: "Notifications",
    notificationsSub: "What Union tells you about, and when",
    privacyRow: "Privacy & your data",
    helpRow: "Help & support",

    // Edit profile
    profileTitle: "Your profile",
    profileSubtitle: "The details that are only about you.",
    detailsSection: "Your details",
    nameLabel: "Your name",
    editOnWedding: "Edit",
    nameEditsOnWedding:
      "Your name is edited from Your wedding — that's what Union uses everywhere it introduces you.",
    email: "Email",
    emailNote:
      "You sign in with an emailed code, so there's no password here — contact support if this needs to change.",
    phone: "Phone",
    phoneCountry: "Country",
    phoneLocalPlaceholder: "6 12 34 56 78",
    phoneHint:
      "Used for reminders and so a vendor can reach you fast if something needs a real answer.",
    saved: "Saved.",

    // Your wedding
    weddingTitle: "Your wedding",
    weddingKicker: "Wedding settings",
    partnerNotSet: "…",
    emptyPrompt:
      "Fill in your date and venue and Union starts building the plan around them.",
    detailsHeading: "The details",
    dateLabel: "Wedding date",
    venueLabel: "Venue",
    addressLineLabel: "Address (number & street)",
    addressLinePlaceholder: "123 Orchard Rd",
    addressPostalCodeLabel: "Zip / postal code",
    addressPostalCodePlaceholder: "97031",
    addressCityLabel: "City",
    addressCityPlaceholder: "Hood River",
    addressAreaLabel: "Area",
    addressAreaPlaceholder: "OR",
    addressAreaHint: "State, region, department, or anything else worth mentioning.",
    addressCountryLabel: "Country",
    addressCountryPlaceholder: "United States",
    addressVisibilityLabel: "What guests see before the full address",
    addressVisibilityHidden: "Nothing — keep it confidential for now",
    addressVisibilityPartial: "General area only — no street address",
    addressVisibilityFull: "Full address",
    addressVisibilityHint:
      "Guests always see the venue name, if you've set one. \"General area\" shares the zip code, city, area & country — everything but the exact street address. Switch to \"Full address\" once it's ready to share.",
    guestTargetLabel: "Guest count · target",
    styleLabel: "Style & vibe",
    stylePlaceholder: "Garden · warm neutrals · relaxed",
    manageSection: "Manage",
    deleteWedding: "Delete wedding & data",
    deleting: "Deleting…",
    deleteConfirmTitle: "Delete this wedding?",
    deleteConfirmBody: (couple: string) =>
      `This permanently deletes ${couple}'s wedding — guests, RSVPs, seating, everything. This can't be undone.`,
    deleteConfirmPrompt: "Type the phrase below to confirm.",
    deletePhrase: (name: string) => `delete ${name}'s wedding`,
    deleteConfirmAction: "Delete permanently",
    deleteConfirmMismatch: "That phrase doesn't match yet.",

    // App settings
    settingsTitle: "Settings",
    settingsKicker: "App settings",
    autonomyLabel: "How much Union does on its own",
    autonomyAsk: "Ask first",
    autonomySuggest: "Suggest",
    autonomyAuto: "Auto",
    autonomyDescAsk:
      "Union brings you every option and waits for your yes before it books, pays, or replies on your behalf.",
    autonomyDescSuggest:
      "Union recommends the next step and gets your go-ahead before anything happens.",
    autonomyDescAuto:
      "Union handles the routine calls itself, and only interrupts you for the decisions that matter.",
    connectedSection: "Connected",
    connectedCalendar: "Calendar",
    connectedCalendarStatus: "Apple · on",
    connectedEmail: "Email for vendors",
    connectedOn: "Connected",
    connectedContacts: "Contacts",
    connectedOff: "Not connected",

    // Notifications
    notifTitle: "Notifications",
    notifPreviewNotice:
      "Preview — there's no notification engine wired up yet, so toggling these doesn't send anything. The channels below are illustrative.",
    notifyWhen: "Notify me when",
    notifVendorReplies: "A vendor replies",
    notifVendorRepliesSub: "Quotes, questions, confirmations",
    notifGuestRsvps: "A guest RSVPs",
    notifGuestRsvpsSub: "Yes, no, and dietary notes",
    notifUnionActions: "Union takes an action",
    notifUnionActionsSub: "When it books or negotiates for you",
    notifCoOrganiser: "A co-organiser does something",
    notifCoOrganiserSub: "Anyone you've invited to help plan",
    rhythm: "Rhythm",
    notifWeeklyDigest: "Weekly digest",
    notifWeeklyDigestSub: "One calm summary, Sunday evening",
    notifQuietHours: "Quiet hours",
    notifQuietHoursSub: "Nothing between 9pm and 8am",
    channels: "Channels",
    channelPush: "Push",
    channelOn: "On",
    channelEmail: "Email",
    channelDigestOnly: "Digest only",

    // Privacy
    privacyTitle: "Privacy & your data",
    privacyIntro:
      "Union keeps only what it needs to plan your wedding with you — no ad tracking, nothing sold. Here's what's stored, and where.",
    privacyWhatWeKeep: "What we keep",
    privacyAccountTitle: "Your account",
    privacyAccountBody: "Name, email, and phone — used to sign you in and reach you.",
    privacyWeddingTitle: "Your wedding",
    privacyWeddingBody:
      "Date, venue, guest target, and style — the facts Union plans around.",
    privacyGuestsTitle: "Your guest list",
    privacyGuestsBody:
      "Names, contact info, RSVPs, and dietary notes — visible only to you and anyone you invite to help.",
    privacyDeleteTitle: "Delete everything",
    privacyDeleteBody:
      "Deleting your wedding permanently removes it and everything under it — guests, RSVPs, seating, all of it.",
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

  // Localized sample content: keys shared with sample.ts so /vendors, /plan,
  // /guests demo data reads in the current language.
  sample: {
    notice:
      "Sample data — a preview of this feature. It isn't connected to your account yet.",

    // Vendors board
    vendors: {
      wildflowerBarn: {
        name: "Wildflower Barn",
        category: "Venue",
        blurb: "Deposit paid, it's yours",
        statusLabel: "Booked",
      },
      emberOak: {
        name: "Ember & Oak",
        category: "Catering",
        blurb: "Union chasing signature",
        statusLabel: "Contract out",
      },
      wildStem: {
        name: "The Wild Stem",
        category: "Florals",
        blurb: "$540 under budget",
        statusLabel: "Approve",
      },
      larkLens: {
        name: "Lark & Lens",
        category: "Photography",
        blurb: "Union shortlisted 2",
        statusLabel: "Comparing",
      },
      astoria: {
        name: "Astoria Quartet",
        category: "Music",
        blurb: "Ceremony + cocktail hour",
        statusLabel: "Booked",
      },
      mille: {
        name: "Mille-Feuille",
        category: "Cake",
        blurb: "Not started yet",
        statusLabel: "To do",
      },
    },

    // Negotiation thread
    negotiation: {
      unionWho: "Union · for you",
      rosaWho: "Rosa · The Wild Stem",
      turn1:
        "Hi Rosa — Maya & Daniel adore your garden-style work. Their florals budget is $3,200. Your quote came in at $3,840. Is there any room to get closer?",
      turn2:
        "We could do $3,500 if we swap the imported peonies for local garden roses — honestly just as lush this time of year.",
      turn3:
        "Local roses sound perfect. Let's meet at $3,300 and we'll feature you on the couple's public vendor page. Deal?",
      turn4:
        "Deal — $3,300 it is. I'll send the updated contract over. 🌿",
    },

    // Today "Union is handling"
    handling: [
      {
        title: "Chasing Ember & Oak's signed contract",
        sub: "Catering · follow-up sent this morning",
        tag: "In motion",
      },
      {
        title: "Comparing 2 photographers",
        sub: "Both under budget · quotes back Thursday",
        tag: "In motion",
      },
      {
        title: "Confirming the Astoria Quartet",
        sub: "Arrival time & ceremony set list",
        tag: "In motion",
      },
    ] as { title: string; sub: string; tag: string }[],

    // Budget lines
    budgetLines: {
      venue: "Venue",
      catering: "Catering",
      florals: "Florals",
      photography: "Photography",
      music: "Music",
      attire: "Attire",
    },

    // Plan / What's next
    thisWeek: [
      {
        title: "Approve the florist's quote",
        sub: "$540 under budget. Locking it frees the deposit slot.",
        cta: "Review & approve",
      },
      {
        title: "Nudge 20 guests to RSVP",
        sub: "Cutoff for the caterer's headcount is in 3 weeks.",
        cta: "Let Union send reminders",
      },
    ] as { title: string; sub: string; cta: string }[],

    bookSoon: [
      { title: "Order invitations", sub: "6-week print + mail lead time" },
      {
        title: "Book a hair & makeup trial",
        sub: "Best trial dates fill 8 weeks out",
      },
      {
        title: "Reserve rentals — arch & chairs",
        sub: "Peak-season stock is limited",
      },
    ] as { title: string; sub: string }[],

    later: [
      "Finalize the menu tasting",
      "Confirm guest transport",
      "Write day-of timeline for vendors",
    ] as string[],

    // Weekend run-of-show
    schedule: [
      {
        time: "1:00",
        title: "Vendors arrive & set up",
        sub: "The Wild Stem · Ember & Oak",
        loc: "The barn — service entrance",
      },
      {
        time: "2:30",
        title: "Hair & makeup wraps",
        sub: "Bridal suite",
        loc: "Bridal suite, main house",
      },
      {
        time: "4:00",
        title: "Ceremony",
        sub: "Astoria Quartet plays",
        loc: "The lawn",
      },
      {
        time: "4:30",
        title: "Cocktail hour",
        sub: "Passed hors d'oeuvres",
        loc: "The orchard",
      },
      {
        time: "6:00",
        title: "Reception & dinner",
        sub: "Ember & Oak serves",
        loc: "The barn",
      },
      {
        time: "11:00",
        title: "Sparkler send-off",
        sub: "Shuttle #1 departs for the inn",
        loc: "Front drive",
      },
    ] as { time: string; title: string; sub: string; loc: string }[],

    // Team & activity
    team: [
      { name: "Maya", sub: "Full access", role: "Owner" as const },
      {
        name: "Daniel",
        sub: "Joined 3 days ago · full access",
        role: "Partner" as const,
      },
      {
        name: "Line · Maya's mom",
        sub: "Invited · can view",
        role: "Pending" as const,
      },
    ],
    activity: [
      {
        who: "Daniel",
        text: "approved The Wild Stem's quote",
        sub: "Florals · 2 hours ago",
      },
      {
        who: "Union",
        text: "negotiated florals to $3,300",
        sub: "Saved $540 · 2 hours ago",
      },
      {
        who: "Maya",
        text: "added Fernwood Film Co.",
        sub: "New vendor · yesterday",
      },
      { who: "Daniel", text: "invited Maya to plan together", sub: "3 days ago" },
      {
        who: "Maya",
        text: "set the florals budget to $3,200",
        sub: "3 days ago",
      },
    ] as { who: string; text: string; sub: string }[],

    // Photographer search
    search: {
      title: "Photographer search",
      started: "Started 2 days ago",
      timeline: [
        {
          text: "Shortlisted 6 who match your style",
          sub: "Filtered on documentary + golden-hour · Mon",
          done: true,
        },
        {
          text: "Reached out with your date & budget",
          sub: "Personalized note to each · Mon",
          done: true,
        },
        {
          text: "Lark & Lens replied — available!",
          sub: "Sent samples from a barn wedding · Tue",
          done: true,
        },
        {
          text: "Comparing 2 finalists for you",
          sub: "Waiting on your budget call above",
          done: false,
        },
      ] as { text: string; sub: string; done: boolean }[],
    },
  },

  // SMS invitation template (settings page)
  smsTemplate: {
    title: "SMS template",
    subtitle:
      "Draft the invitation SMS once — Union will personalise every send with the guest's first name and their access link.",
    apiKeyLabel: "Your Brevo account",
    apiKeyField: "Brevo API key",
    apiKeyPlaceholder: "xkeysib-…",
    apiKeyShow: "Show",
    apiKeyHide: "Hide",
    apiKeyHint: "SMS sends run on your own Brevo account, not Union's — grab your transactional API key from",
    apiKeyLinkText: "Brevo → Settings → API Keys",
    apiKeyCreditsHint:
      "Note: Brevo also requires you to purchase an SMS credits add-on before sending works — email credits alone aren't enough.",
    senderLabel: "Sender",
    senderField: "SMS sender name or phone",
    senderPlaceholder: "e.g. Maya, or +33612345678",
    senderHint:
      "Up to 11 letters/digits for a name, or a phone number in international format. Guests see this as the sender of your SMS.",
    templateLabel: "Message",
    templateHint:
      "Use the tokens below to insert dynamic fields. Everything else is written as-is.",
    placeholderTitle: (key: string) => `Insert ${key}`,
    previewLabel: "Live preview",
    previewHint:
      "How the message renders for a sample guest — updates as you type.",
    previewEmpty: "Type a message above to see the preview.",
    charCount: (n: number) => `${n} character${n === 1 ? "" : "s"}`,
    segmentCount: (n: number, enc: string) =>
      `${n} SMS · ${enc}`,
    save: "Save template",
    saved: "Saved",
  },
};

// Widening `typeof en` to a Dictionary type keeps every key + function
// signature in the shape, but relaxes the value type from a specific string
// literal (like "Sign in") down to `string`. Otherwise the FR file would
// have to write the exact same English literals — the whole point of the
// typed-dictionaries setup is to enforce shape parity, not literal parity.
export type Dictionary = typeof en;
