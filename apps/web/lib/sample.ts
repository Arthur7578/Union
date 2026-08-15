/**
 * Sample data for the Union web app.
 *
 * Screens backed by a real Supabase schema (Today countdown, Guests, the
 * team/activity feed on Plan together) use live data. Everything else —
 * Vendors, negotiation, budget, seating, stays, the weekend run-of-show —
 * is not backed by tables yet, so it renders from this module.
 *
 * All user-visible text lives in the i18n dictionaries (`sample.*`), so a
 * locale switch changes the demo copy too. Structural fields (ids, tones,
 * percentages, monograms) are hardcoded because they carry design meaning,
 * not language.
 *
 * Every consumer of this data pairs it with a <SampleBadge/> or <DemoBanner/>
 * so it is always obvious in the UI that you're looking at a preview.
 */

import type { Dictionary } from "./i18n/dictionaries/en";

/** Fixed structural constants — never localized. */
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

export type ChatTurn = {
  from: "union" | "vendor";
  who: string;
  text: string;
};

export type BudgetLine = {
  label: string;
  spent: number;
  cap: number | null;
  pct: number;
  tone: "green" | "accent" | "faint";
  note?: string;
};

export type ScheduleMoment = {
  time: string;
  title: string;
  sub: string;
  loc: string;
  vendors: string;
  timing: string;
  accent?: boolean;
};

/** Builds the full sample dataset in the given language. Call from a client
 *  component with `getSample(t)` — the dictionary itself carries locale. */
export function getSample(t: Dictionary) {
  const v = t.sample.vendors;
  const vendors: SampleVendor[] = [
    {
      id: "wildflower-barn",
      name: v.wildflowerBarn.name,
      category: v.wildflowerBarn.category,
      blurb: v.wildflowerBarn.blurb,
      status: "booked",
      statusLabel: v.wildflowerBarn.statusLabel,
      monogram: "V",
      tint: "green",
    },
    {
      id: "ember-and-oak",
      name: v.emberOak.name,
      category: v.emberOak.category,
      blurb: v.emberOak.blurb,
      status: "contract",
      statusLabel: v.emberOak.statusLabel,
      monogram: "E",
      tint: "amber",
    },
    {
      id: "the-wild-stem",
      name: v.wildStem.name,
      category: v.wildStem.category,
      blurb: v.wildStem.blurb,
      status: "approve",
      statusLabel: v.wildStem.statusLabel,
      monogram: "W",
      tint: "accent",
    },
    {
      id: "lark-and-lens",
      name: v.larkLens.name,
      category: v.larkLens.category,
      blurb: v.larkLens.blurb,
      status: "comparing",
      statusLabel: v.larkLens.statusLabel,
      monogram: "L",
      tint: "amber",
    },
    {
      id: "astoria-quartet",
      name: v.astoria.name,
      category: v.astoria.category,
      blurb: v.astoria.blurb,
      status: "booked",
      statusLabel: v.astoria.statusLabel,
      monogram: "A",
      tint: "green",
    },
    {
      id: "mille-feuille",
      name: v.mille.name,
      category: v.mille.category,
      blurb: v.mille.blurb,
      status: "todo",
      statusLabel: v.mille.statusLabel,
      monogram: "M",
      tint: "sand",
    },
  ];

  const negotiation: ChatTurn[] = [
    { from: "union", who: t.sample.negotiation.unionWho, text: t.sample.negotiation.turn1 },
    { from: "vendor", who: t.sample.negotiation.rosaWho, text: t.sample.negotiation.turn2 },
    { from: "union", who: t.sample.negotiation.unionWho, text: t.sample.negotiation.turn3 },
    { from: "vendor", who: t.sample.negotiation.rosaWho, text: t.sample.negotiation.turn4 },
  ];

  const budget: BudgetLine[] = [
    { label: t.sample.budgetLines.venue, spent: 14000, cap: 14000, pct: 100, tone: "green" },
    { label: t.sample.budgetLines.catering, spent: 8400, cap: 9500, pct: 88, tone: "accent" },
    { label: t.sample.budgetLines.florals, spent: 3300, cap: 3840, pct: 86, tone: "accent" },
    {
      label: t.sample.budgetLines.photography,
      spent: 4500,
      cap: null,
      pct: 8,
      tone: "faint",
      note: t.plan.notePending,
    },
    { label: t.sample.budgetLines.music, spent: 2940, cap: 3000, pct: 98, tone: "green" },
    {
      label: t.sample.budgetLines.attire,
      spent: 4000,
      cap: null,
      pct: 4,
      tone: "faint",
      note: t.plan.notePlanned,
    },
  ];

  const thisWeek = t.sample.thisWeek.map((item, i) => ({
    ...item,
    owner: i === 0 ? t.plan.ownerYou : t.plan.ownerUnion,
    primary: i === 0,
  }));

  const schedule: ScheduleMoment[] = t.sample.schedule.map((m, i) => ({
    ...m,
    vendors: m.sub,
    timing: m.sub,
    accent: i === 2,
  }));

  const search = {
    ...t.sample.search,
    reachedOut: 6,
    replied: 4,
    finalists: 2,
  };

  return {
    couple: SAMPLE_COUPLE,
    vendors,
    negotiation,
    handling: t.sample.handling,
    budget,
    thisWeek,
    bookSoon: t.sample.bookSoon,
    later: t.sample.later,
    schedule,
    search,
  };
}

export type Sample = ReturnType<typeof getSample>;
