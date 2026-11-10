---
name: Union
description: A neutral, premium planning frame with one graphite accent; the couple's own details are the only personality.
colors:
  ground: "#F6F6F4"
  surface: "#FFFFFF"
  ink: "#1B1B1A"
  ink-2: "#45443F"
  muted: "#686660"
  track: "#ECECEA"
  cant: "#C9C7C1"
  ring: "#D6D4CE"
  line: "rgba(27,27,26,0.08)"
  line-strong: "rgba(27,27,26,0.14)"
  hover: "rgba(27,27,26,0.035)"
  chrome: "rgba(246,246,244,0.92)"
  accent: "#1B1B1A"
  accent-2: "#8C8B86"
  accent-soft: "#ECECEA"
  focus: "rgba(27,27,26,0.18)"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  numeral:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "76px"
    fontWeight: 500
    lineHeight: 0.82
    letterSpacing: "-0.045em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  row-title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
  caption:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  bar: "5px"
  chip: "10px"
  control: "12px"
  field: "14px"
  group: "18px"
  panel: "20px"
  round: "50%"
spacing:
  hairline-gap: "3px"
  xs: "8px"
  sm: "12px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  section: "34px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-primary-small:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "50px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px 22px 20px"
  list-group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
  list-row:
    textColor: "{colors.ink}"
    padding: "11px 16px"
    height: "60px"
  avatar-attending:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.round}"
    size: "38px"
---

# Design System: Union

> **Scope.** This file records the neutral-frame world as built on two pages only: the Guests hub (`/guests`) and the guest list (`/guests/list`). It is a trial; the finish review has not yet returned ship. The rest of the signed-in app still runs on the older warm palette `T` in `lib/theme.ts` (and the guest-facing pages on `G` and `P`); those palettes are deliberately not documented here. The shared app shell (sidebar, bottom tab bar) is not part of this world yet: on these two pages it only takes the neutral ground as a translucent background.
>
> **Source of truth.** Every colour is defined in `lib/theme.ts` (`V`, `CSS_VARS`); ESLint bans hex elsewhere. The stylesheet reads them as `--vc-*` custom properties, set on `<html>` by the root layout.

## Overview

**Creative North Star: "The Neutral Frame"**

Union's interface takes no wedding style of its own. The frame is near-white ground, white cards with hairline borders, near-black ink and one calm grotesque with tabular numerals; it should sit equally well beside a bohemian, black-tie, minimal or rustic wedding. The personality comes from the couple: their names and date in the page header, and their guests. Theme neutrality is a binding product principle (PRODUCT.md, principle 5), confirmed after a themed trial read as childish and divisive.

There is one fixed accent, graphite, the same for every couple. It carries the actions, the answered count and the "yes" in the replies; a lighter stone marks "maybe". Nothing about the colour varies from one wedding to the next.

Density is calm and phone-first: one column on a phone, large readable numbers, rows tall enough for a thumb (60px), and at most one filled action per area. Depth is soft and ambient, never decorative.

**Key Characteristics:**
- A neutral, very slightly warm grey frame with no hue at all.
- One fixed graphite accent for actions and "yes", a lighter stone for "maybe".
- One face, Hanken Grotesk, semibold headings with tight negative tracking, tabular figures for every count.
- White cards on a near-white ground, separated by hairlines and a faint ambient shadow.
- Generous radii (10 to 20px) and 44px-plus touch targets.

## Colors

A near-neutral, very slightly warm grey frame with a single graphite accent.

### Primary
- **Graphite** (accent): primary buttons, the selected filter chip, the big reply numeral, the "Coming" segment and legend dot, the attending reply label, the "no email" alert, links such as "See all", hovered chevrons, focus outlines and the search caret. White on it is 17:1. It shares its value with ink but is a separate token: accent marks action and "yes", ink marks text.
- **Maybe Stone** (accent-2): the "maybe" segment of the reply bar, its legend dot, and the ring on a "maybe" avatar. Lighter than graphite so the two answers read apart.
- **Graphite Wash** (accent-soft): the attending avatar ground and text selection.
- **Focus Halo** (focus): graphite at 18%, the search field's focus halo. A sibling tint, graphite at 12%, colours the primary button's shadow (see Elevation).

### Neutral
- **Paper Ground** (ground): the page background, also tinted into the shell chrome at 92% (chrome).
- **Card White** (surface): panels, list groups, chips, fields, ghost buttons; also the text colour on graphite fills.
- **Near-Black Ink** (ink): titles, row titles, strong figures.
- **Soft Ink** (ink-2): secondary prose, legend labels, unselected chip text, the "maybe" reply label, declined avatar text.
- **Quiet Grey** (muted): row subtitles, placeholders, the search icon, notes, declined and waiting reply labels.
- **Empty Track** (track): the "waiting" part of the reply bar (the bare track still to fill) and the declined avatar ground.
- **Can't-Come Stone** (cant): the "declined" segment of the reply bar.
- **Pending Ring** (ring): hairline rings on pending avatars and the waiting legend dot, and resting chevrons.
- **Hairline** (line) and **Strong Hairline** (line-strong): ink at 8% for card borders and row dividers, ink at 14% for inset outlines on chips, ghost buttons and fields.
- **Hover Wash** (hover): ink at 3.5% under hovered rows, links and ghost controls.

### Named Rules
**The One Accent Rule.** Graphite is the only accent in the world, and it is fixed. Status is told with graphite plus neutrals (coming = graphite, maybe = stone, declined = can't-come stone, waiting = bare track), never with green, amber or red.

**The Variables Rule.** Components read `var(--vc-*)` (or `V` in inline styles); they never write a hex. A new colour is added to `V` and exposed through `CSS_VARS`.

## Typography

**Display Font:** Hanken Grotesk (with system-ui, sans-serif), loaded with `next/font` as `--font-vc`, weights 400 to 700.
**Body Font:** the same face.

**Character:** one calm, neutral grotesque for everything; hierarchy comes from size, weight (500 and 600) and tight negative tracking at large sizes, never from a second face.

### Hierarchy
- **Display** (600, 40px on a phone, 46px from 960px, line-height 1.05, -0.03em): the page title. Sub-pages such as the list use the same style at 26px beside a back button.
- **Numeral** (500, 76px, line-height 0.82, -0.045em, tabular): the one big count of answered replies, in graphite. One per page.
- **Headline** (600, 28px, line-height 1.15, -0.025em, balanced wrap): the sentence that replaces the numeral (all answered, none yet) and empty-state titles.
- **Title** (600, 19px, line-height 1.2, -0.015em, balanced wrap): section headings above list groups.
- **Row title** (600, 15px, single line with ellipsis): the name or tool in a list row.
- **Body** (500, 14.5px, line-height 1.5): couple line, legend labels, quiet prose; 14px in the nudge. Supporting line beside the numeral at 16px.
- **Label** (600, 14.5px; 14px on small buttons and chips): buttons, chips, "See all" links.
- **Caption** (13px, sometimes 13.5px for notes): row subtitles, status notes.

### Named Rules
**The Tabular Count Rule.** Every number that counts guests (the numeral, legend counts, chip counts, the invited total) uses tabular figures.

**The Sentence Case Rule.** Headings and labels are sentence case at reading size. There are no uppercase, tracked-out labels in this world.

## Layout

Phone first, one column. The header pairs the title (with the couple's names and date beneath, in quiet grey) against the primary "Add" button. On the hub the reply panel comes first, the search field directly beneath it so it lands in the first phone viewport, then the latest replies, then every guest tool grouped by stage.

Spacing runs on a small set of steps: 3px between bar segments, 8 to 14px inside rows and between controls, 18 to 22px inside panels and under the header, and 34px above each section heading. Headings keep a 2px inset from card edges so type aligns optically with card contents.

From 960px the main column widens to 1060px and the hub becomes a two-column grid (1.1fr and 1fr, 40px gap): replies, search and latest on the left, tools on the right. The reply legend flows into as many 150px columns as fit. The list page caps its body at 760px, and the filter chips wrap instead of scrolling. On a phone the chips scroll sideways edge to edge with the scrollbar hidden.

## Elevation & Depth

A hybrid of hairlines and soft ambient shadow. Most depth comes from white surfaces on the paper ground, separated by 1px hairlines; only the hero panel and the primary button lift.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 1px 2px var(--vc-shadow), 0 12px 32px var(--vc-shadow)`, ink at 5%): the reply panel and empty-state panels only.
- **Primary glow** (`box-shadow: 0 2px 8px var(--vc-accent-shadow)`, graphite at 12%, rising to `0 4px 12px` on hover): the primary button.
- **Inset outline** (`box-shadow: inset 0 0 0 1px var(--vc-line-strong)`): chips, ghost and back buttons, the search field. Outlines are drawn inside so controls keep their size.

### Named Rules
**The Quiet Lift Rule.** Shadows are diffuse and low-opacity; list groups and rows sit flat with hairlines. Only one panel per view carries the lift.

## Shapes

Softly rounded and consistent by size: 5px on bar segments, 10px on chips and legend links, 12px on buttons and the back button, 14px on the search field, 18px on list groups, 20px on panels. Avatars and legend dots are full circles. List groups clip their rows, which are divided by hairlines rather than gaps.

## Components

### Buttons
Calm and solid; the one filled action in its area.
- **Shape:** gently rounded (12px), 44px tall, 18px side padding, label type.
- **Primary:** graphite with white text and the primary glow. Used for "Add guest" and "Send nudge".
- **Hover / Focus / Active:** the glow deepens on hover; focus draws a 2px graphite outline 2px out; press scales to 0.98. Disabled at 60% opacity.
- **Small:** 40px tall, 15px padding, 14px label (header on sub-pages, nudge).
- **Ghost:** white with a strong hairline inset outline and ink text; hover wash on hover. Secondary actions such as "Share the group link".
- **Back:** a 40px square ghost button holding a chevron.

### Chips
- **Style:** white, strong hairline inset outline, soft ink label, 38px tall, 10px radius; count in tabular figures at 70% opacity.
- **State:** the pressed filter (`aria-pressed`) fills with graphite and white text, outline removed. One selected at a time.

### Cards / Containers
- **Reply panel:** white, hairline border, 20px radius, 24px 22px 20px padding, panel lift. Holds the numeral or headline, the split reply bar, the legend and the nudge (above a hairline divider).
- **List group:** white, hairline border, 18px radius, rows divided by hairlines, no shadow.
- **Empty state:** the panel at 28px 24px 26px padding with a headline, quiet prose (46ch) and one primary plus one ghost action.

### Inputs / Fields
- **Search:** 50px tall, 14px radius, white with a strong hairline inset outline, muted search icon, 16px input text (keeps iOS from zooming).
- **Focus:** the outline turns 1.5px graphite with a 4px focus halo; the caret is graphite.

### Navigation
- **List rows:** 60px minimum, 11px 16px padding, avatar or text block, a chevron at the end in pending-ring grey that turns graphite on hover; the row gets the hover wash. Focus draws the outline inside the group (-2px offset).
- **Legend links:** a two-column grid of 42px links (dot, label, count pushed right), each opening the list filtered by that reply.
- **Section link ("See all"):** graphite, 14px semibold, underline fading in on hover.

### Reply Bar (signature)
One 10px bar split by answer with 3px gaps and 5px-rounded segments: coming in graphite, maybe in stone (only when the wedding allows maybe or has one), declined in can't-come stone, waiting as the bare track. Segments grow into place over 0.9s on `cubic-bezier(0.16, 1, 0.3, 1)`; reduced motion removes the transition. The bar is one labelled image for assistive tech.

### Reply Avatar (signature)
A 38px circle with the guest's initial: attending is graphite wash with graphite text, maybe is white with a 1.5px stone ring, declined is the track with soft ink, pending is white with a pending-ring outline and muted text.

## Do's and Don'ts

### Do:
- **Do** put `gu-main` and `guestsTypeClass` on the page root of every surface in this world, so it gets the neutral ground and Hanken Grotesk.
- **Do** use graphite for actions, the answered count, "yes" and the selected state; stone only for "maybe".
- **Do** keep touch targets at 44px or more for buttons and 60px for list rows, and 16px text in inputs.
- **Do** use tabular figures for every count.
- **Do** honour `prefers-reduced-motion` for the bar, rows, buttons and field transitions.

### Don't:
- **Don't** give the interface a wedding style: no romantic cream and serif, garden-party motifs or black-tie ornament (PRODUCT.md, principle 5).
- **Don't** add a second hue: no brand colour beside graphite, no green, amber or red status colours in this world.
- **Don't** vary the accent; it is one fixed graphite for every couple.
- **Don't** add a second typeface.
- **Don't** write a hex in a component; read `var(--vc-*)` or `V`.
