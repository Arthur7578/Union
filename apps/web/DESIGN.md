---
name: Union
description: Garden marquee, the couple's app world on trial in the Guests tab (/guests and /guests/list).
colors:
  ground: "#F3F7F1"
  surface: "#FFFFFF"
  ink: "#1E3A2D"
  ink-2: "#41594C"
  muted: "#5E7366"
  leaf: "#2E6B4E"
  leaf-deep: "#24563E"
  sage: "#CFE3D2"
  sage-soft: "#E6F0E7"
  coming: "#4F9A6E"
  maybe: "#E8B23F"
  cant: "#E79C90"
  waiting: "#B9C7BD"
  blush: "#F9DEDA"
  blush-ink: "#9E3F37"
  butter: "#FBEFC6"
  butter-ink: "#7A5A0F"
  line: "rgba(30,58,45,0.1)"
  line-soft: "rgba(30,58,45,0.06)"
  hover: "rgba(46,107,78,0.06)"
  focus-halo: "rgba(46,107,78,0.22)"
typography:
  display:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "42px"
    fontWeight: 400
    lineHeight: 1
  numeral:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 0.8
    fontFeature: "tnum"
  headline:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
  row-title:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 800
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.5
  input:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
  meta:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  tag:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 800
rounded:
  pill: "999px"
  panel: "28px"
  group: "24px"
  row: "20px"
  link: "14px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.leaf-deep}"
    textColor: "{colors.surface}"
  button-primary-small:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  button-ghost-hover:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.ink}"
  button-back:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "42px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 15px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.surface}"
  input-find:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "54px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "22px 20px 18px"
  group-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
    padding: "4px 0"
  row:
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "10px 16px"
    height: "62px"
  row-hover:
    backgroundColor: "{colors.hover}"
  nudge-footer:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.ink-2}"
    padding: "16px 20px 18px"
  tag-attending:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.leaf}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "26px"
  tag-maybe:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.butter-ink}"
  tag-declined:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.blush-ink}"
  tag-pending:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
  avatar-face:
    rounded: "{rounded.circle}"
    size: "40px"
---

# Design System: Union

> **Scope: a trial.** The Garden marquee world currently covers only the couple's Guests hub (`/guests`) and guest list (`/guests/list`). Every other screen of the couple's app still uses the incumbent palette `T` in `lib/theme.ts` (warm cream, rosewood accent, Cormorant Garamond and Instrument Sans), which this file does not document. The guest-facing pages keep their own palettes (`G`, `P`). Treat everything below as the trial world's record: it is provisional until the direction is reviewed and either extended to the rest of the app or withdrawn. Source of truth for values: palette `M` and the `--mq-*` entries of `CSS_VARS` in `lib/theme.ts`, the "Garden marquee" section at the end of `app/globals.css`, and the faces in `app/(app)/guests/marquee.ts`.

## Overview

**Creative North Star: "The Garden Marquee"**

The guest list is the party gathering under the reception tent. Each page opens under a full-bleed canopy of sage-and-white stripes ending in a scalloped valance, with a string of festoon lights below it on the hub, and the title standing in the shaded inside of the tent, which fades into a fresh leaf-white ground. Below the tent everything is white and rounded: a big reply panel, pill controls, white row cards resting on the leaf ground.

The mood is joyful, light and fresh, not stationery. Caprasimo, a soft round display face, carries the titles and the numbers; Nunito, a rounded sans, carries the interface at heavy weights (600 to 800). Density is phone-first and calm: one panel, one search, a short list of latest replies, then the tools grouped by stage. The world rejects, by its own thesis, the wedding category default of cream paper, serif display and rosewood stationery, and the generic dashboard of stat tiles.

**Key Characteristics:**
- Striped canopy with scalloped valance at the top of every page in the world, edge to edge of the content area.
- Leaf-white ground, white surfaces, deep forest ink; leaf green is the one action colour.
- Replies speak in three soft tints (sage, butter, blush) plus an empty ring for waiting.
- Everything round: pills, circles, 20 to 28px cards. No square corners.
- Soft shadows tinted with forest ink, never grey or black, never offset hard.

## Colors

A garden palette: forest inks on a leaf-white ground, one leaf-green action, and three party tints that mean replies.

### Primary
- **Leaf Green** (leaf): the action colour. Primary buttons, the selected filter chip, the "see all" link, row chevrons, the answered numeral, focus outlines and the search caret. White text on it holds 6.3:1.
- **Deep Leaf** (leaf-deep): hover state of leaf-filled buttons and of the "see all" link. Nothing else.

### Secondary
- **Canopy Sage** (sage): the coloured stripe of the canopy. Structural only; never text, never a fill for controls.
- **Sage Mist** (sage-soft): the tent interior (top of the tent gradient), ghost/chip/back hover fill, the "coming" tag and avatar fill, and the pale "waiting" track of the reply bar.

### Tertiary (the reply colours)
- **Garden Green** (coming): the "coming" segment and dot of the reply bar; also the text selection tint.
- **Lantern Gold** (maybe): the "maybe" segment and dot, and the festoon bulbs.
- **Rose Petal** (cant): the "can't come" segment and dot.
- **Waiting Ring** (waiting): the outline of a waiting dot and a waiting avatar. A graphic edge only (1.75:1 on white); never text.
- **Butter** (butter) with **Butter Ink** (butter-ink): the "maybe" tag and avatar, and the nudge footer of the reply panel.
- **Blush** (blush) with **Blush Ink** (blush-ink): the "can't come" tag and avatar; blush-ink alone also flags a waiting guest with no email.

### Neutral
- **Leaf White** (ground): the page ground under the tent; the waiting tag fill. The app shell's tab bar and sidebar take it at 92% opacity (`--mq-chrome`) on these pages.
- **White** (surface): panels, row cards, pills, the white canopy stripe, and text on leaf.
- **Forest Ink** (ink): titles, row titles, strong values.
- **Forest Ink 2** (ink-2): secondary text: count captions, legend labels, chip labels, nudge copy.
- **Moss Grey** (muted): meta lines, quiet notes, placeholders, the search icon (4.7:1 on ground, 5.1:1 on white).
- **Hairline** (line, ink at 10%): inset outlines of ghost buttons, chips, the back button and the search field. **Soft Hairline** (line-soft, ink at 6%): dividers between rows and the shell's borders.
- **Leaf Wash** (hover, leaf at 6%): hover fill of rows and legend links. **Focus Halo** (focus-halo, leaf at 22%): the outer ring of the focused search field.

### Named Rules
**The Reply Colour Rule.** Sage/green means coming, butter/gold means maybe, blush/rose means can't come, an empty ring on white means waiting. These tints carry replies (and the nudge about replies); they are not decoration and are never swapped.

**The One Leaf Rule.** Leaf green is the only colour a control is filled with. Secondary actions are white pills with a hairline, not a second accent.

**The Theme-Only Rule.** Every colour is defined in `M` in `lib/theme.ts` and reaches CSS as a `--mq-*` variable; tints are built with `alpha()` there. No hex anywhere else (ESLint enforces it).

## Typography

**Display Font:** Caprasimo (with Georgia, serif), weight 400 only, loaded by next/font as `--font-mq-display`.
**Body Font:** Nunito (with system-ui, sans-serif), weights 400/600/700/800, loaded as `--font-mq-sans`.

**Character:** Caprasimo is soft, round and celebratory, used big and sparingly; Nunito is a rounded, legible workhorse set heavy, so the interface feels friendly without going thin. Both fonts load only on the two trial pages (`marqueeClass`).

### Hierarchy
- **Display** (Caprasimo 400, 42px, 50px at 960px and up, line-height 1): the page title in the tent. The list page's slim header uses a smaller one-off title (26px, 1.05).
- **Numeral** (Caprasimo 400, 72px, line-height 0.8, tabular figures, leaf): the answered count in the reply panel.
- **Headline** (Caprasimo 400, 30px, 1.1, balanced): the reply panel's sentence when all or none have answered, and empty-state titles.
- **Title** (Caprasimo 400, 24px, 1.15, balanced): section headings ("Latest replies", the tool stages), optionally led by the bunting mark.
- **Row title** (Nunito 800, 15.5px): names and tool labels in rows; one line, ellipsis.
- **Label** (Nunito 800, 15px; 14px for small buttons, chips and the "see all" link): buttons, chips, links.
- **Body** (Nunito 600, 14.5px, 1.5): quiet notes and empty-state copy, capped at about 46ch. The nudge copy is 14px/1.45.
- **Input** (Nunito 600, 16px): the search field; 16px so phones do not zoom.
- **Meta** (Nunito 600, 13px): row sub-lines (reply and time, group and role).
- **Tag** (Nunito 800, 12.5px): reply tags.

### Named Rules
**The Round Voice Rule.** Caprasimo is for titles and numbers only, always at weight 400 and 24px or more (the 18px avatar initial is the one exception). Every word of interface is Nunito at 600 or heavier.

**The Tabular Count Rule.** Every count (numeral, legend values, chip counts, list total) uses tabular figures.

## Layout

Phone first. The tent bleeds edge to edge of the content area (negative margins past the main column and the top safe area); its inner column is the viewport minus 40px (20px gutters), capped at 996px. Under it, a single column: reply panel, search field (in the first phone viewport, by design), latest replies, then the tool stages.

At 960px and up the main column widens to 1060px, the tent bleeds up to the sidebar, the canopy grows from 52px to 64px (slim: 26px to 32px), the hub splits into two columns (1.1fr / 1fr, 40px gap, top-aligned) with the stages on the right, the list body caps at 760px, and the filter chips wrap instead of scrolling.

Rhythm: 4px row-card inset, 8 to 12px between inline items, 16px row and search padding, 20 to 22px panel padding, 30 to 32px above section headings. Touch targets are 40px or more (chips, small buttons), 42 to 46px for back and buttons, 54px for search, 62px for rows. On a phone the filter chips scroll sideways and bleed 18px past the column, and the active chip is scrolled into view.

## Elevation & Depth

Lightly lifted. White surfaces float on the leaf ground with soft, wide shadows tinted with forest ink, and the canopy casts a drop shadow onto the tent. Depth also comes from the tent itself: a sage-mist gradient that fades into the ground. Outlines are inset hairlines, not borders.

### Shadow Vocabulary
- **Canopy cast** (`filter: drop-shadow(0 6px 6px rgba(30,58,45,0.08))`): under the canopy and its scallops.
- **Panel lift** (`box-shadow: 0 12px 32px rgba(30,58,45,0.08)`): the reply panel.
- **Card lift** (`box-shadow: 0 6px 20px rgba(30,58,45,0.08)`): row cards.
- **Action lift** (`box-shadow: 0 6px 16px rgba(30,58,45,0.18)`): primary leaf buttons.
- **Hairline outline** (`box-shadow: inset 0 0 0 1.5px rgba(30,58,45,0.1)`): ghost buttons, chips, back button, search field.

### Named Rules
**The Forest Shadow Rule.** Shadows are tinted with forest ink at 8% (18% for the leaf button), blurred wide, offset only downward. Never grey or black, never a hard offset.

## Shapes

Everything is round. Controls are full pills (999px) or circles (avatars 40px, back button 42px, legend dots 11px); containers are generously curved (panel 28px, row card 24px, row hover 20px, legend links 14px). The reply bar's segments are pills with a 4px gap.

The signature silhouette is the scallop: the canopy ends in one 14px-deep half-circle flap per 28px stripe, and the nudge footer's top edge repeats it at a smaller 10px scallop every 20px, both cut with a radial-gradient mask. The bunting mark (three pennants on a drooping string) and the festoon lights are the world's two drawn ornaments, both inline SVG in `MarqueeTop.tsx`.

### Named Rules
**The Valance Rule.** Scallops belong to the canopy and to the panel footer that hangs from it. They mark something hanging, never a generic divider.

## Components

### Buttons
Round, heavy and confident.
- **Shape:** full pill (999px), 46px tall, 20px side padding; small variant 40px tall, 16px padding, 14px label.
- **Primary:** leaf fill, white Nunito 800 label, action lift shadow. Hover: deep leaf.
- **Ghost:** white fill, forest ink label, inset hairline. Hover: sage-mist fill.
- **Back:** 42px white circle with a hairline and a left chevron; hover sage mist.
- **Press / Focus:** scale(0.97) on press (0.12s); focus is a 2.5px leaf outline at 2px offset. Disabled primary drops to 60% opacity.

### Chips
- **Style:** white pill, 40px, ink-2 Nunito 800 14px label with an optional tabular count at 80% opacity, inset hairline.
- **State:** selected (`aria-pressed`) is a leaf fill with white text and no outline; hover sage mist. Used as the reply filter on the list, synced to `?status=` in the URL.

### Cards / Containers
- **Reply panel:** white, 28px corners, 22/20/18px padding, panel lift. Holds the numeral, the reply bar, the two-column legend of reply links, and the butter nudge footer.
- **Row card (group):** white, 24px corners, 4px vertical padding, card lift; rows are divided by soft hairlines inset 16px.
- **Empty states** reuse the panel with a headline, a quiet line and leaf/ghost buttons.

### Inputs / Fields
- **Search ("find"):** white pill, 54px, 18px padding, inset hairline, a moss-grey search icon, Nunito 600 16px, leaf caret.
- **Focus:** the hairline becomes a 2px leaf inset plus a 5px leaf halo (`focus-halo`).

### Navigation
- The app shell's tab bar and sidebar switch to leaf white at 92% with a soft hairline while a marquee page is shown (`.u-app:has(.mq)`).
- Within the world, navigation is by rows: each row is a link with a leaf chevron on the right; rows hover with the leaf wash and focus with an inset leaf outline.

### Reply bar and legend (signature)
One 14px bar split into pill segments by reply (coming, maybe, can't, then waiting as the pale sage-mist track), growing on load (0.9s, `cubic-bezier(0.16, 1, 0.3, 1)`). Below it a two-column legend: dot, label, tabular count, each a link into the filtered list.

### Guest row and avatar face
Round 40px avatar with the guest's initial in Caprasimo, coloured by reply (sage mist and leaf, butter and butter ink, blush and blush ink, or white with a waiting ring). Name in row title, a meta line, an optional reply tag (only when the list is unfiltered), and a leaf chevron.

### Canopy (signature)
`MarqueeTop`: striped canopy (28px stripes, sage and white) with the scalloped valance, festoon lights on the hub, and the title in the tent below. The list page uses the slim canopy without festoon lights.

## Do's and Don'ts

### Do:
- **Do** open every page of this world with `MarqueeTop` (full canopy on a hub, slim on a sub-page) and put the page title inside the tent.
- **Do** fill actions with leaf green and give secondary actions a white pill with a 1.5px inset hairline.
- **Do** use the reply tints only for replies: sage for coming, butter for maybe, blush for can't come, an empty ring for waiting.
- **Do** keep controls pills or circles, at least 40px tall, and cards at 20 to 28px corners.
- **Do** set titles and numbers in Caprasimo 400 and everything else in Nunito 600 to 800; use tabular figures for counts.
- **Do** tint shadows with forest ink at 8% (18% for the leaf button) and add new colours to `M` in `lib/theme.ts` as `--mq-*` variables.
- **Do** keep French copy in mind: titles balance, rows ellipsize, chips scroll on a phone.
- **Do** turn transitions off under `prefers-reduced-motion`.

### Don't:
- **Don't** bring back the category default this world refuses: cream paper, serif display, rosewood stationery.
- **Don't** summarise replies as a row of stat tiles; use the one reply bar and its legend.
- **Don't** mix the incumbent `T` palette or its fonts into a marquee page, or marquee tokens into a `T` page, while the trial runs.
- **Don't** use grey or black shadows, or hard offset shadows.
- **Don't** add small uppercase labels (kickers, eyebrows) above titles.
- **Don't** write a hex value outside `lib/theme.ts`.
- **Don't** use the waiting ring colour for text; it is a graphic edge only.
