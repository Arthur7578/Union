/**
 * Sample data for the Union web app.
 *
 * The screens backed by a real Supabase schema (Today countdown, Guests) use
 * live data. Everything else — Vendors, negotiation, budget, seating, stays,
 * the weekend run-of-show, collaborators — is not backed by tables yet, so it
 * renders from this module.
 *
 * Every consumer of this data pairs it with a <SampleBadge/> or <DemoBanner/>
 * so it is always obvious in the UI that you're looking at a preview, not your
 * own account. `SAMPLE_NOTICE` is the shared wording for those markers.
 */

export const SAMPLE_NOTICE =
  "Sample data — a preview of this feature. It isn't connected to your account yet.";

/** The demo couple everything below belongs to. */
export const SAMPLE_COUPLE = {
  partnerOne: "Maya",
  partnerTwo: "Daniel",
  venue: "Wildflower Barn",
  date: "Sept 20, 2026",
  daysToGo: 68,
  budgetTotal: 41200,
  budgetCommitted: 28640,
};

export type VendorStatus =
  | "booked"
  | "contract"
  | "approve"
  | "comparing"
  | "todo";

export type SampleVendor = {
  id: string;
  name: string;
  category: string;
  blurb: string;
  status: VendorStatus;
  statusLabel: string;
  monogram: string;
  tint: "green" | "amber" | "accent" | "sand";
};

export const SAMPLE_VENDORS: SampleVendor[] = [
  {
    id: "wildflower-barn",
    name: "Wildflower Barn",
    category: "Venue",
    blurb: "Deposit paid, it's yours",
    status: "booked",
    statusLabel: "Booked",
    monogram: "V",
    tint: "green",
  },
  {
    id: "ember-and-oak",
    name: "Ember & Oak",
    category: "Catering",
    blurb: "Union chasing signature",
    status: "contract",
    statusLabel: "Contract out",
    monogram: "E",
    tint: "amber",
  },
  {
    id: "the-wild-stem",
    name: "The Wild Stem",
    category: "Florals",
    blurb: "$540 under budget",
    status: "approve",
    statusLabel: "Approve",
    monogram: "W",
    tint: "accent",
  },
  {
    id: "lark-and-lens",
    name: "Lark & Lens",
    category: "Photography",
    blurb: "Union shortlisted 2",
    status: "comparing",
    statusLabel: "Comparing",
    monogram: "L",
    tint: "amber",
  },
  {
    id: "astoria-quartet",
    name: "Astoria Quartet",
    category: "Music",
    blurb: "Ceremony + cocktail hour",
    status: "booked",
    statusLabel: "Booked",
    monogram: "A",
    tint: "green",
  },
  {
    id: "mille-feuille",
    name: "Mille-Feuille",
    category: "Cake",
    blurb: "Not started yet",
    status: "todo",
    statusLabel: "To do",
    monogram: "M",
    tint: "sand",
  },
];

/** The negotiation thread shown on the vendor detail screen (Union at work). */
export type ChatTurn = {
  from: "union" | "vendor";
  who: string;
  text: string;
};

export const SAMPLE_NEGOTIATION: ChatTurn[] = [
  {
    from: "union",
    who: "Union · for you",
    text: "Hi Rosa — Maya & Daniel adore your garden-style work. Their florals budget is $3,200. Your quote came in at $3,840. Is there any room to get closer?",
  },
  {
    from: "vendor",
    who: "Rosa · The Wild Stem",
    text: "We could do $3,500 if we swap the imported peonies for local garden roses — honestly just as lush this time of year.",
  },
  {
    from: "union",
    who: "Union · for you",
    text: "Local roses sound perfect. Let's meet at $3,300 and we'll feature you on the couple's public vendor page. Deal?",
  },
  {
    from: "vendor",
    who: "Rosa · The Wild Stem",
    text: "Deal — $3,300 it is. I'll send the updated contract over. 🌿",
  },
];

/** Today's "Union is handling" live items. */
export const SAMPLE_HANDLING = [
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
];

/** Budget breakdown by category. */
export type BudgetLine = {
  label: string;
  spent: number;
  cap: number | null;
  pct: number;
  tone: "green" | "accent" | "faint";
  note?: string;
};

export const SAMPLE_BUDGET: BudgetLine[] = [
  { label: "Venue", spent: 14000, cap: 14000, pct: 100, tone: "green" },
  { label: "Catering", spent: 8400, cap: 9500, pct: 88, tone: "accent" },
  { label: "Florals", spent: 3300, cap: 3840, pct: 86, tone: "accent" },
  { label: "Photography", spent: 4500, cap: null, pct: 8, tone: "faint", note: "pending" },
  { label: "Music", spent: 2940, cap: 3000, pct: 98, tone: "green" },
  { label: "Attire", spent: 4000, cap: null, pct: 4, tone: "faint", note: "planned" },
];

/** "What's next" — this week's actionable items. */
export const SAMPLE_THIS_WEEK = [
  {
    title: "Approve the florist's quote",
    sub: "$540 under budget. Locking it frees the deposit slot.",
    owner: "You",
    cta: "Review & approve",
    primary: true,
  },
  {
    title: "Nudge 20 guests to RSVP",
    sub: "Cutoff for the caterer's headcount is in 3 weeks.",
    owner: "Union",
    cta: "Let Union send reminders",
    primary: false,
  },
];

export const SAMPLE_BOOK_SOON = [
  { title: "Order invitations", sub: "6-week print + mail lead time" },
  { title: "Book a hair & makeup trial", sub: "Best trial dates fill 8 weeks out" },
  { title: "Reserve rentals — arch & chairs", sub: "Peak-season stock is limited" },
];

export const SAMPLE_LATER = [
  "Finalize the menu tasting",
  "Confirm guest transport",
  "Write day-of timeline for vendors",
];

/** The weekend run-of-show (Saturday). */
export type ScheduleMoment = {
  time: string;
  title: string;
  sub: string;
  loc: string;
  vendors: string;
  timing: string;
  accent?: boolean;
};

export const SAMPLE_SCHEDULE: ScheduleMoment[] = [
  {
    time: "1:00",
    title: "Vendors arrive & set up",
    sub: "The Wild Stem · Ember & Oak",
    loc: "The barn — service entrance",
    vendors: "The Wild Stem · Ember & Oak",
    timing: "Load-in from 1:00",
  },
  {
    time: "2:30",
    title: "Hair & makeup wraps",
    sub: "Bridal suite",
    loc: "Bridal suite, main house",
    vendors: "Bloom Beauty Co.",
    timing: "Two artists · finish 2:30",
  },
  {
    time: "4:00",
    title: "Ceremony",
    sub: "Astoria Quartet plays",
    loc: "The lawn",
    vendors: "Astoria Quartet · Rev. Ellis",
    timing: "Officiant arrives 3:15",
    accent: true,
  },
  {
    time: "4:30",
    title: "Cocktail hour",
    sub: "Passed hors d'oeuvres",
    loc: "The orchard",
    vendors: "Ember & Oak",
    timing: "Bar opens 4:30",
  },
  {
    time: "6:00",
    title: "Reception & dinner",
    sub: "Ember & Oak serves",
    loc: "The barn",
    vendors: "Ember & Oak · Astoria Quartet",
    timing: "First dance ~7:45",
  },
  {
    time: "11:00",
    title: "Sparkler send-off",
    sub: "Shuttle #1 departs for the inn",
    loc: "Front drive",
    vendors: "Sunset Shuttle Co.",
    timing: "Shuttle #1 · 11:15",
  },
];

/** Guest groups (colour-coded) + people with a role. */
export const SAMPLE_GROUPS = [
  { count: 12, name: "Immediate family", sub: "Tables 1 · front rows", dot: "#F2E1E0", ring: "#C79BA0" },
  { count: 24, name: "Extended family", sub: "Both sides", dot: "#EEDCDF", ring: "#C79BA0" },
  { count: 18, name: "College friends", sub: "Table 2", dot: "#E7EFE6", ring: "#A9C0AC" },
  { count: 16, name: "Work & neighbors", sub: "Table 3", dot: "#FBEEE2", ring: "#DDB27C" },
  { count: 7, name: "Wedding party", sub: "Head + front", dot: "#E4E7EE", ring: "#A6ACC0" },
];

export const SAMPLE_ROLES = [
  { name: "Marcus Bell", sub: "Also a witness", role: "Best man", monogram: "M" },
  { name: "Priya Shah", sub: "Also a witness", role: "Maid of honor", monogram: "P" },
  { name: "Rev. Aline Costa", sub: "Arrives 3:15", role: "Officiant", monogram: "A" },
  { name: "Theo Okafor · age 5", sub: "Kids meal · with family", role: "Ring bearer", monogram: "T" },
];

/** Room blocks + who's staying where. */
export const SAMPLE_ROOM_BLOCKS = [
  {
    name: "Wildflower Inn",
    sub: "$140/night · 5 min from the barn",
    status: "Held",
    pct: 67,
    note: "8 of 12 rooms booked · block held until Aug 20",
    tone: "accent",
  },
  {
    name: "The Orchard Cottages",
    sub: "Family & wedding party",
    status: "Full",
    pct: 100,
    note: "6 of 6 rooms booked",
    tone: "green",
  },
];

export const SAMPLE_STAYS = [
  { name: "The Okafor family", sub: "Orchard Cottages · Cottage 2", status: "Booked", tone: "green" },
  { name: "Priya & Sam", sub: "Wildflower Inn · Room 4", status: "Booked", tone: "green" },
  { name: "James Lin", sub: "Wildflower Inn · not booked yet", status: "Nudge", tone: "amber" },
];

/** Collaborators (Plan together). */
export const SAMPLE_TEAM = [
  { name: "Maya", sub: "Full access", role: "Owner", you: true, monogram: "M", tone: "accent" },
  { name: "Daniel", sub: "Joined 3 days ago · full access", role: "Partner", you: false, monogram: "D", tone: "green" },
  { name: "Line · Maya's mom", sub: "Invited · can view", role: "Pending", you: false, monogram: "L", tone: "amber" },
];

export const SAMPLE_ACTIVITY = [
  { who: "Daniel", text: "approved The Wild Stem's quote", sub: "Florals · 2 hours ago", kind: "person" },
  { who: "Union", text: "negotiated florals to $3,300", sub: "Saved $540 · 2 hours ago", kind: "union" },
  { who: "Maya", text: "added Fernwood Film Co.", sub: "New vendor · yesterday", kind: "person" },
  { who: "Daniel", text: "invited Maya to plan together", sub: "3 days ago", kind: "person" },
  { who: "Maya", text: "set the florals budget to $3,200", sub: "3 days ago", kind: "person" },
];

/** Photographer search-in-progress. */
export const SAMPLE_SEARCH = {
  title: "Photographer search",
  started: "Started 2 days ago",
  reachedOut: 6,
  replied: 4,
  finalists: 2,
  timeline: [
    { text: "Shortlisted 6 who match your style", sub: "Filtered on documentary + golden-hour · Mon", done: true },
    { text: "Reached out with your date & budget", sub: "Personalized note to each · Mon", done: true },
    { text: "Lark & Lens replied — available!", sub: "Sent samples from a barn wedding · Tue", done: true },
    { text: "Comparing 2 finalists for you", sub: "Waiting on your budget call above", done: false },
  ],
};
