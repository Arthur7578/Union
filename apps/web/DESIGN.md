---
name: Union
description: A neutral, premium planning frame that wears one colour, the couple's own wedding colour.
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
  wedding-base: "#55544F"
  wedding-deep: "#1B1B1A"
  wedding-soft: "#ECECEA"
  wedding-focus: "rgba(27,27,26,0.18)"
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
    backgroundColor: "{colors.wedding-deep}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-primary-small:
    backgroundColor: "{colors.wedding-deep}"
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
    backgroundColor: "{colors.wedding-deep}"
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
    backgroundColor: "{colors.wedding-soft}"
    textColor: "{colors.wedding-deep}"
    rounded: "{rounded.round}"
    size: "38px"
---

# Design System: Union

> **Scope.** This file records the "Your colours" world as built on two pages only: the Guests hub (`/guests`) and the guest list (`/guests/list`). It is a trial; the finish review has not yet returned ship. The rest of the signed-in app still runs on the older warm palette `T` in `lib/theme.ts` (and the guest-facing pages on `G` and `P`); those palettes are deliberately not documented here. The shared app shell (sidebar, bottom tab bar) is not part of this world yet: on these two pages it only takes the neutral ground as a translucent background. The wedding colour picker (`components/AccentPicker.tsx`) lives on the account page, inside `T`.
>
> **Source of truth.** Every colour is defined in `lib/theme.ts` (`V`, `NEUTRAL_ACCENT`, `ACCENTS`, `CSS_VARS`); ESLint bans hex elsewhere. The stylesheet reads them as `--vc-*` (the frame) and `--wa-*` (the wedding colour) custom properties.

## Overview

**Creative North Star: "The Neutral Frame That Wears Their Colour"**

Union's interface takes no wedding style of its own. The frame is near-white ground, white cards with hairline borders, near-black ink and one calm grotesque with tabular numerals; it should sit equally well beside a bohemian, black-tie, minimal or rustic wedding. The personality comes from the couple: their names and date in the page header, and exactly one colour, the wedding colour they picked. Theme neutrality is a binding product principle (PRODUCT.md, principle 5), confirmed after a themed trial read as childish and divisive.

The wedding colour is not a free hex. It is a preset key stored in `weddings.accent` (sage, terracotta, dusty blue, navy, burgundy, rose, ochre, lilac, black) or null, which falls back to Union's own graphite. Each preset resolves to three shades (base for fills, deep for text and buttons, soft for tinted grounds), and every set is checked for WCAG AA by a unit test. A page sets the shades as `--wa-*` variables on its root element; everything below reads them.

Density is calm and phone-first: one column on a phone, large readable numbers, rows tall enough for a thumb (60px), and at most one coloured action per area. Depth is soft and ambient, never decorative.

**Key Characteristics:**
- A neutral, warm-grey frame; the couple's colour is the only hue on screen.
- One preset colour in three AA-checked shades, set per page as `--wa-*`; graphite when unset.
- One face, Hanken Grotesk, semibold headings with tight negative tracking, tabular figures for every count.
- White cards on a near-white ground, separated by hairlines and a faint ambient shadow.
- Generous radii (10 to 20px) and 44px-plus touch targets.

## Colors

A near-neutral, very slightly warm grey frame, plus one colour that belongs to the couple.

### Primary
- **The Wedding Colour** (`--wa-base`, `--wa-deep`, `--wa-soft`): the couple's preset. The frontmatter records the graphite default (`wedding-base`, `wedding-deep`, `wedding-soft`); pages override them with `accentVars(weddings.accent)`. Deep carries every coloured word and action: primary buttons, the selected filter chip, the big reply numeral, links such as "See all", the attending reply label, focus outlines, the search caret. Base fills: the swatch dot beside the couple's names, the "maybe" segment of the reply bar, the ring on a "maybe" avatar. Soft tints: the attending avatar and text selection. Two derived tints sit alongside, `--wa-focus` (deep at 18%, the search field's focus halo) and `--wa-shadow` (deep at 12%, the primary button's shadow).

Presets (defined in `ACCENTS`, `lib/theme.ts`; keys in `packages/shared/src/weddingAccent.ts`; the database check constraint accepts only these):

| Key | base | deep | soft |
| --- | --- | --- | --- |
| (none, graphite) | #55544F | #1B1B1A | #ECECEA |
| sage | #7A9A7E | #3F6146 | #E6EEE7 |
| terracotta | #C4673F | #9A4423 | #F7E6DD |
| dusty_blue | #7B97B5 | #3F5F80 | #E5ECF3 |
| navy | #2E4A72 | #1F3557 | #E2E8F1 |
| burgundy | #8E2D43 | #74203A | #F3E1E5 |
| rose | #D08C96 | #A2525E | #F8E8EA |
| ochre | #C9963A | #85601A | #F6EDD9 |
| lilac | #9C88BE | #634F8C | #EEE9F5 |
| black | #8C8B86 | #1B1B1A | #ECECEA |

### Neutral
- **Paper Ground** (ground): the page background, also tinted into the shell chrome at 92% (chrome).
- **Card White** (surface): panels, list groups, chips, fields, ghost buttons; also the text colour on deep fills.
- **Near-Black Ink** (ink): titles, row titles, strong figures.
- **Soft Ink** (ink-2): secondary prose, legend labels, unselected chip text, declined avatar text.
- **Quiet Grey** (muted): row subtitles, placeholders, the search icon, notes.
- **Empty Track** (track): the "waiting" part of the reply bar (the bare track still to fill) and the declined avatar ground.
- **Can't-Come Stone** (cant): the "declined" segment of the reply bar.
- **Pending Ring** (ring): hairline rings on pending avatars and the waiting legend dot, and resting chevrons.
- **Hairline** (line) and **Strong Hairline** (line-strong): ink at 8% for card borders and row dividers, ink at 14% for inset outlines on chips, ghost buttons and fields.
- **Hover Wash** (hover): ink at 3.5% under hovered rows, links and ghost controls.

### Named Rules
**The One Colour Rule.** The wedding colour is the only hue in the world. Status is told with the wedding colour's shades plus neutrals (coming = deep, maybe = base, declined = stone, waiting = bare track), never with green, amber or red.

**The Preset-Only Rule.** A wedding colour is always a preset key with tuned shades, never a free hex. A new preset ships with base, deep and soft and must pass the contrast test in `lib/weddingAccent.test.ts`: white on deep, deep on soft and deep on the ground all at 4.5:1 or more.

**The Variables Rule.** Components read `var(--wa-*)` and `var(--vc-*)`; they never import a preset's hex directly. The default graphite set is also in the root `CSS_VARS`, so the stylesheet always has a colour, even before a page sets one.

## Typography

**Display Font:** Hanken Grotesk (with system-ui, sans-serif), loaded with `next/font` as `--font-vc`, weights 400 to 700.
**Body Font:** the same face.

**Character:** one calm, neutral grotesque for everything; hierarchy comes from size, weight (500 and 600) and tight negative tracking at large sizes, never from a second face.

### Hierarchy
- **Display** (600, 40px on a phone, 46px from 960px, line-height 1.05, -0.03em): the page title. Sub-pages such as the list use the same style at 26px beside a back button.
- **Numeral** (500, 76px, line-height 0.82, -0.045em, tabular): the one big count of answered replies, in wedding deep. One per page.
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

Phone first, one column. The header pairs the title (with the couple's names and date beneath) against the primary "Add" button. On the hub the reply panel comes first, the search field directly beneath it so it lands in the first phone viewport, then the latest replies, then every guest tool grouped by stage.

Spacing runs on a small set of steps: 3px between bar segments, 8 to 14px inside rows and between controls, 18 to 22px inside panels and under the header, and 34px above each section heading. Content keeps a 2px inset from card edges for headings so type aligns optically with card contents.

From 960px the main column widens to 1060px and the hub becomes a two-column grid (1.1fr and 1fr, 40px gap): replies, search and latest on the left, tools on the right. The reply legend flows into as many 150px columns as fit. The list page caps its body at 760px, and the filter chips wrap instead of scrolling. On a phone the chips scroll sideways edge to edge with the scrollbar hidden, and the selected chip scrolls into view.

## Elevation & Depth

A hybrid of hairlines and soft ambient shadow. Most depth comes from white surfaces on the paper ground, separated by 1px hairlines; only the hero panel and the primary button lift.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 1px 2px var(--vc-shadow), 0 12px 32px var(--vc-shadow)`, ink at 5%): the reply panel and empty-state panels only.
- **Primary glow** (`box-shadow: 0 2px 8px var(--wa-shadow)`, rising to `0 4px 12px` on hover): the wedding-colour button, tinted by the wedding colour itself.
- **Inset outline** (`box-shadow: inset 0 0 0 1px var(--vc-line-strong)`): chips, ghost and back buttons, the search field. Outlines are drawn inside so controls keep their size.

### Named Rules
**The Quiet Lift Rule.** Shadows are diffuse and low-opacity; list groups and rows sit flat with hairlines. Only one panel per view carries the lift.

## Shapes

Softly rounded and consistent by size: 5px on bar segments, 10px on chips and legend links, 12px on buttons and the back button, 14px on the search field, 18px on list groups, 20px on panels. Avatars, swatch dots and legend dots are full circles. List groups clip their rows, which are divided by hairlines rather than gaps.

## Components

### Buttons
Calm and solid; the one coloured action in its area.
- **Shape:** gently rounded (12px), 44px tall, 18px side padding, label type.
- **Primary:** wedding deep with white text and the primary glow. Used for "Add guest" and "Send nudge".
- **Hover / Focus / Active:** the glow deepens on hover; focus draws a 2px wedding-deep outline 2px out; press scales to 0.98. Disabled at 60% opacity.
- **Small:** 40px tall, 15px padding, 14px label (header on sub-pages, nudge).
- **Ghost:** white with a strong hairline inset outline and ink text; hover wash on hover. Secondary actions such as "Share the group link".
- **Back:** a 40px square ghost button holding a chevron.

### Chips
- **Style:** white, strong hairline inset outline, soft ink label, 38px tall, 10px radius; count in tabular figures at 70% opacity.
- **State:** the pressed filter (`aria-pressed`) fills with wedding deep and white text, outline removed. One selected at a time.

### Cards / Containers
- **Reply panel:** white, hairline border, 20px radius, 24px 22px 20px padding, panel lift. Holds the numeral or headline, the split reply bar, the legend and the nudge (above a hairline divider).
- **List group:** white, hairline border, 18px radius, rows divided by hairlines, no shadow.
- **Empty state:** the panel at 28px 24px 26px padding with a headline, quiet prose (46ch) and one primary plus one ghost action.

### Inputs / Fields
- **Search:** 50px tall, 14px radius, white with a strong hairline inset outline, muted search icon, 16px input text (keeps iOS from zooming).
- **Focus:** the outline turns 1.5px wedding deep with a 4px wedding-focus halo; the caret is wedding deep.

### Navigation
- **List rows:** 60px minimum, 11px 16px padding, avatar or text block, a chevron at the end in pending-ring grey that turns wedding deep on hover; the row gets the hover wash. Focus draws the outline inside the group (-2px offset).
- **Legend links:** a two-column grid of 42px links (dot, label, count pushed right), each opening the list filtered by that reply.
- **Section link ("See all"):** wedding deep, 14px semibold, underline fading in on hover.

### Reply Bar (signature)
One 10px bar split by answer with 3px gaps and 5px-rounded segments: coming in wedding deep, maybe in wedding base (only when the wedding allows maybe or has one), declined in stone, waiting as the bare track. Segments grow into place over 0.9s on `cubic-bezier(0.16, 1, 0.3, 1)`; reduced motion removes the transition. The bar is one labelled image for assistive tech.

### Reply Avatar (signature)
A 38px circle with the guest's initial: attending is wedding soft with deep text, maybe is white with a 1.5px wedding-base ring, declined is the track with soft ink, pending is white with a pending-ring outline and muted text.

### Wedding Colour Swatch
A 10px wedding-base dot beside the couple's names and date in the header; when no colour is picked, a wedding-deep underlined link invites the couple to pick one. The picker itself (account page, still in the older palette) is a radio group of 40px circles, the selected one ringed in its own colour.

## Do's and Don'ts

### Do:
- **Do** set `accentVars(parseWeddingAccent(wedding.accent))` on the page root of every surface in this world, so `--wa-*` is the couple's colour.
- **Do** use wedding deep for text, buttons and the selected state, base for fills and rings, soft for tinted grounds.
- **Do** add new presets only with all three shades and a passing contrast test (4.5:1 for white on deep, deep on soft, deep on the ground).
- **Do** keep touch targets at 44px or more for buttons and 60px for list rows, and 16px text in inputs.
- **Do** use tabular figures for every count.
- **Do** honour `prefers-reduced-motion` for the bar, rows, buttons and field transitions.

### Don't:
- **Don't** give the interface a wedding style: no romantic cream and serif, garden-party motifs or black-tie ornament (PRODUCT.md, principle 5).
- **Don't** add a second hue: no brand accent beside the wedding colour, no green, amber or red status colours in this world.
- **Don't** accept a free colour from the couple; only preset keys.
- **Don't** add a second typeface.
- **Don't** hard-code a preset's hex in a component; read `var(--wa-*)`.
