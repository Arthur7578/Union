---
name: Union
description: Union's own colours named by role and checked for AA, one modern grotesque, calm cards; the couple's details are the only personality.
colors:
  canvas: "#FAF5F1"
  surface: "#FFFCFA"
  ink: "#43353A"
  ink-2: "#5C4B50"
  muted: "#6E5E62"
  track: "#EFE7DF"
  line: "rgba(67,53,58,0.08)"
  line-strong: "rgba(67,53,58,0.15)"
  hover: "rgba(67,53,58,0.035)"
  white: "#FFFFFF"
  accent: "#B07C82"
  accent-strong: "#8A545C"
  accent-soft: "#F2E1E0"
  focus: "rgba(176,124,130,0.3)"
  coming: "#7E9A82"
  coming-strong: "#4F6A54"
  coming-soft: "#E7EFE6"
  maybe: "#5C648A"
  maybe-soft: "#E4E7EE"
  cant: "#C7A9A2"
  cant-soft: "#F1E7E3"
  waiting: "#DDB27C"
  waiting-strong: "#9A5B23"
  waiting-soft: "#FBEEE2"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  numeral:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  lede:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
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
  meter: "4px"
  skeleton: "8px"
  chip: "10px"
  icon: "11px"
  button: "12px"
  field: "14px"
  group: "18px"
  card: "20px"
  full: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "30px"
  split: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
  button-small:
    rounded: "{rounded.button}"
    padding: "0 14px"
    height: "40px"
  link:
    textColor: "{colors.accent-strong}"
    typography: "{typography.label}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.white}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "50px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
  row:
    textColor: "{colors.ink}"
    padding: "11px 16px"
    height: "60px"
  row-hover:
    backgroundColor: "{colors.hover}"
  task:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
    padding: "16px"
  task-icon:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.icon}"
    size: "36px"
  task-icon-calm:
    backgroundColor: "{colors.track}"
    textColor: "{colors.muted}"
  tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
    height: "58px"
  face:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.full}"
    size: "38px"
  face-attending:
    backgroundColor: "{colors.coming-soft}"
    textColor: "{colors.coming-strong}"
  face-maybe:
    backgroundColor: "{colors.maybe-soft}"
    textColor: "{colors.maybe}"
  face-declined:
    backgroundColor: "{colors.cant-soft}"
    textColor: "{colors.muted}"
  face-pending:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.waiting-strong}"
  back:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    size: "40px"
---

# Design System: Union

> **Scope.** This file documents design system v2 ("ds"). It is being rolled out page by page. **Migrated so far: `/guests` (the hub root) and `/guests/list`.** Every other screen, and the app shell (sidebar, tab bar), still uses the incumbent `T` styles and the components in `components/ui.tsx`; those stay valid until each page migrates. The guest-facing palettes (`G`, `P` in `lib/theme.ts`) and the public RSVP page are out of scope. To move a page across, follow "Migrating a page" at the end.
>
> **Sources of truth.** Colours: `DS` in `lib/theme.ts`, exposed as `--ds-*` custom properties through `CSS_VARS`. Face: Hanken Grotesk, loaded in `app/layout.tsx` as `--font-ds` (not preloaded, so only migrated pages fetch it). Classes: the "Union design system v2" section of `app/globals.css`. A page opts in with the `ds` class on its root.

## Overview

**Creative North Star: "The Couple's Desk"**

A calm, warm working surface that belongs to Union and to nobody's wedding. Cream canvas, white-cream cards drawn with hairlines, warm ink, one modern grotesque, and a single rosewood voice for the action that matters. The palette is Union's incumbent colours (rosewood, cream, warm ink, sage, dusty blue, sand, amber), renamed by role and given the darker shades that make text pass WCAG AA.

Union is theme-neutral (PRODUCT.md, principle 5): the interface never takes on a wedding style, so it cannot exclude a bohemian, black-tie, minimal or rustic couple. Personality comes from the couple's own content (their guests, their replies, their words), never from the chrome. A themed "garden marquee" trial and a black-and-white neutral frame were both rejected; this is the middle path.

The density is phone-first and Operate-mode: short visits, one-tap actions, large type for the one number that matters, quiet type for everything else. On desktop the same content opens into two columns rather than growing new furniture.

**Key Characteristics:**
- Union's own colours named by role; text only in the roles that pass AA.
- One face (Hanken Grotesk) at a few tight sizes, weight 600 for anything that names something.
- Flat hairline surfaces; only the summary card and the filled button lift.
- One filled rosewood button per area; everything else is ghost or link.
- Reply status always uses the same four-colour vocabulary: coming, maybe, can't, waiting.

## Colors

Warm, low-chroma neutrals carry the page; rosewood marks action, and four muted hues carry the reply status.

### Primary
- **Rosewood Deep** (accent-strong): the action colour. Filled buttons, links, the selected chip, text on rosewood tints, the hover state of row chevrons, focus outlines. White on it reads at 5.99:1.
- **Rosewood** (accent): shapes only. Fills, dots, and the base of the focus halo (`focus`, rosewood at 30%). Never text (3.21:1 on canvas).
- **Rosewood Blush** (accent-soft): the tint behind rosewood text: initials faces with no status, task icons, text selection.

### Secondary (reply status)
- **Sage** (coming) / **Deep Sage** (coming-strong) / **Sage Mist** (coming-soft): guests who are coming. Sage fills meter segments and dots; Deep Sage is the text and initials colour; Sage Mist the face tint.
- **Dusty Blue** (maybe) / **Blue Mist** (maybe-soft): guests who are unsure. Dusty Blue is dark enough to be both the fill and the text.
- **Sand Rose** (cant) / **Sand Mist** (cant-soft): guests who can't come. Sand Rose is a fill only; their text falls back to `muted`, so a decline reads as quiet, not alarming.
- **Amber Ring** (waiting) / **Burnt Amber** (waiting-strong) / **Amber Mist** (waiting-soft): guests who have not answered. Amber Ring draws outlines (the pending face's inset ring, the legend's hollow dot); Burnt Amber is the text ("no email", "waiting").

### Neutral
- **Cream Canvas** (canvas): the page ground.
- **Cream Card** (surface): cards, groups, tasks, tiles, fields, ghost buttons, chips.
- **Warm Ink** (ink): titles, row titles, body text that matters.
- **Warm Ink Soft** (ink-2): secondary copy that still reads as content (unselected chips, the summary's "of N invited", legend).
- **Warm Grey** (muted): subtitles, row metadata, quiet paragraphs, placeholders, the search icon.
- **Sand Track** (track): the empty part of a meter and the waiting segment, the calm task icon, the skeleton shimmer base.
- **Hairline** (line) and **Hairline Strong** (line-strong): ink at 8% and 15%. Card, group and tile borders; dividers between rows; the inset outline of ghost buttons, chips, fields and the back button.
- **Hover Wash** (hover): ink at 3.5%, the hover fill for rows, tiles, chips and ghost buttons.

### Contrast (computed, WCAG 2.x relative luminance)

| Text role | on canvas | on surface | on its soft tint | Use as text |
| --- | --- | --- | --- | --- |
| ink | 10.72 | 11.36 | n/a | yes |
| ink-2 | 7.53 | 7.98 | n/a | yes |
| muted | 5.64 | 5.97 | 5.02 (cant-soft) / 4.99 (track) | yes |
| accent-strong | 5.54 | 5.87 | 4.74 (accent-soft) | yes |
| coming-strong | 5.51 | 5.84 | 5.08 (coming-soft) | yes |
| maybe | 5.32 | 5.64 | 4.65 (maybe-soft) | yes |
| waiting-strong | 4.98 | 5.28 | 4.73 (waiting-soft) | yes, but not on track (4.41) |
| white on accent-strong | | | 5.99 | yes (filled button, selected chip) |
| accent | 3.21 | 3.40 | 2.75 | no: shapes only |
| coming | 2.84 | 3.01 | 2.62 | no: shapes only |
| cant | 2.02 | 2.14 | 1.80 | no: shapes only |
| waiting | 1.81 | 1.92 | 1.72 | no: outlines only |

### Named Rules
**The AA Text Rule.** Text takes only `ink`, `ink-2`, `muted`, `accent-strong`, `coming-strong`, `maybe` or `waiting-strong`. `accent`, `coming`, `cant` and `waiting` are for fills, dots and rings, never for letters.

**The Rosewood Voice Rule.** Rosewood Deep marks what you can act on: the one filled button, links, the selected chip, the focused element. It is never decoration.

**The Waiting Ring Rule.** Not answering is an absence, so it is drawn hollow: an amber ring on the pending face and the legend dot, and plain track in the meter. Only the answers get solid colour.

## Typography

**Display Font:** Hanken Grotesk (with system-ui, sans-serif), loaded as `--font-ds`
**Body Font:** Hanken Grotesk, same stack
**Numerals:** the same face with tabular figures (`ds-num`) wherever a count can change

**Character:** one modern grotesque, tightly tracked at display sizes and neutral at reading sizes; it names things at weight 600 and explains them at 400 or 500 in a muted colour.

### Hierarchy
- **Display** (600, 38px, 44px from 960px, line-height 1.05, -0.03em, balanced): the page title, one per page. Module sub-pages currently set it to 26px inline.
- **Numeral** (600, 44px, line-height 0.9, -0.04em, tabular): the single figure a hub leads with (replies answered).
- **Lede** (600, 26px, line-height 1.15, -0.025em): a statement that replaces the numeral ("everyone has answered") and empty-state titles.
- **Headline** (600, 18px, line-height 1.25, -0.015em): section headings ("To do", "Modules"), sentence case, 30px above, 12px below.
- **Title** (600, 15px row titles; 15.5px task titles, line-height 1.3): the name of one thing in a list or card.
- **Body** (400, 14.5px quiet paragraphs at line-height 1.5; 14px task bodies at 1.45), in `muted`. Empty-state copy holds to about 46ch.
- **Label** (600, 14.5px; 14px on small buttons and chips): buttons, chips, links, tile labels.
- **Caption** (400, 13px row metadata; 12.5px tile meta; 13px/600 tile group labels), in `muted`. Sentence case throughout.

### Named Rules
**The Sentence-Case Heading Rule.** Section headings are Headline type in sentence case. No uppercase, letter-spaced eyebrow or kicker above or in place of a heading.

**The One Number Rule.** A hub leads with at most one Numeral; everything else is Title size or below.

## Layout

Phone-first single column inside the app shell's main area (`u-main`), content inset 2px from card edges for headings so type aligns with card borders. Rhythm: 6 and 8px inside clusters (chips, tiles), 10 to 14px between related blocks (task list gap 10px, header gap 12px, task icon to text 14px), 16 to 20px for card and task padding, 20px under the page header, 30px above each section heading.

The page header is a row: title block on the left (title, then a muted subtitle 6px below), one action on the right.

Filter chips scroll sideways on a phone, bleeding 18px past the content edge so the row reads as continuous; from 960px they wrap in place.

From 960px, a page with `ds-wide` widens its main column to 1060px and a `ds-split` lays out two columns (1.15fr and 1fr, 40px gap, top-aligned): the work on the left, the way into the modules on the right. A list page inside `ds-wide` holds its content to 760px (`ds-narrow`). Hub tiles are always a two-column grid with an 8px gap.

## Elevation & Depth

Mostly flat, with tonal layering: cream-card surfaces on a cream canvas, separated by hairlines. Lift is reserved for two things: the summary card that a hub leads with, and the filled button.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 1px 2px var(--ds-shadow), 0 10px 28px var(--ds-shadow)`, shadow = ink at 6%): `ds-card` only.
- **Button glow** (`0 2px 8px var(--ds-accent-shadow)`, rising to `0 4px 14px` on hover; rosewood deep at 20%): the filled button only.
- **Inset outline** (`inset 0 0 0 1px var(--ds-line-strong)`): ghost buttons, chips, fields, back button. An outline, not depth.

### Named Rules
**The Quiet Lift Rule.** Groups, rows, tasks and tiles are flat with a 1px hairline. Only the lead card and the filled button cast a shadow, so the eye goes to the summary and to the action.

## Shapes

Soft, generous rounding that grows with the container: 4px meter segments, 8px skeleton bars, 10px chips, 11px task icons, 12px buttons and the back button, 14px fields and tiles, 18px groups and task cards, 20px cards. Faces and dots are circles. Borders are 1px hairlines; the field's focus thickens its inset outline to 1.5px. Groups clip their rows (`overflow: hidden`) so row hover washes respect the corners.

## Components

### Buttons
Confident and few.
- **Shape:** gently rounded (12px), at least 44px tall (40px for `is-small`), 18px side padding (14px small), icon gap 7px.
- **Primary (`ds-btn`):** Rosewood Deep fill, white label at 600, button glow. One per area.
- **Ghost (`ds-btn is-ghost`):** Cream Card with a strong-hairline inset outline, ink label; hover wash on hover.
- **Hover / Focus / Active:** glow deepens on hover; 2px Rosewood Deep outline at 2px offset on focus-visible; scales to 0.98 when pressed (0.12s); disabled at 60% opacity.
- **Link (`ds-link`):** Rosewood Deep, 600, 14px, underline fades in on hover (offset 3px). For secondary actions next to a button ("not now", "see who").
- **Back (`ds-back`):** a 40px ghost square with a chevron, left of a sub-page title.

### Chips
- **Style:** 38px tall, 10px corners, Cream Card with a strong-hairline outline, Warm Ink Soft label at 600; an optional count in tabular figures at 75% opacity.
- **State:** toggles carry `aria-pressed`; pressed chips fill Rosewood Deep with white text and drop the outline. Grouped in a `role="group"` with a label.

### Cards / Containers
- **Card (`ds-card`):** 20px corners, Cream Card, 1px hairline, card lift, 20px padding. The lead summary and empty states.
- **Group (`ds-group`):** a list of rows in one 18px-cornered Cream Card, hairline-divided, flat.
- **Row (`ds-row`):** at least 60px tall, 11px by 16px padding, 12px gap: face, title and caption, optional status on the right, chevron that turns rosewood on hover. The whole row is the link.

### Inputs / Fields
- **Style (`ds-field`):** 50px tall, 14px corners, Cream Card with a strong-hairline inset outline, leading muted icon, 16px input text (keeps iOS from zooming), muted placeholder, rosewood caret. Labels are visually hidden (`ds-sr`) when the icon and placeholder carry the meaning.
- **Focus:** the outline becomes 1.5px Rosewood Deep with a 4px rosewood halo at 30%.

### Navigation
The app shell (sidebar, tab bar) is not migrated and keeps its incumbent styles. Inside a migrated page, navigation is the back button and hub tiles.

### Reply status (signature)
One vocabulary in four places, keyed `is-attending`, `is-maybe`, `is-declined`, `is-pending`:
- **Face (`ds-face`):** 38px initials circle, 600, tinted by status (Sage Mist / Blue Mist / Sand Mist with their AA text colour); pending is a Cream Card circle with an inset 1.5px Amber Ring and Burnt Amber initials. With no status it is Rosewood Blush.
- **Status (`ds-status`):** the status word at 600 in the matching AA text colour.
- **Dot (`ds-dot`):** 10px circle in the fill colour; waiting is a hollow amber ring.
- **Meter (`ds-meter`):** an 8px track split into rounded segments with 3px gaps, each segment's width its count, eased in over 0.9s (`cubic-bezier(0.16, 1, 0.3, 1)`). Carries `role="img"` and a spoken summary.

### Replies summary (signature)
The hub's lead card, and a link into the list: the Numeral ("answered") with an Ink Soft "of N invited", or a Lede when everyone has answered; the meter 16px below; a legend of dots and counts. While loading it shows skeletons, never a zero.

### Task cards (signature)
One thing that needs the couple, with one action. An 18px-cornered flat card, 16px padding: a 36px rounded-square icon (Rosewood Blush, or Sand Track for calm items), a Title, a muted body, actions 12px below. The first pressing task carries the filled small button; the others use ghost small buttons or a link. When nothing needs them, a single calm task says so.

### Tiles (signature)
Entry points to a hub's modules: a two-column grid of 14px-cornered flat tiles, label at 600 and a muted caption; the caption turns Rosewood Deep and 600 when the module needs attention. Grouped under small muted sentence-case group labels.

### Skeleton
Loading placeholders shaped like the content they replace (a face circle and a title bar for a row, an icon square and two lines for a task), shimmering track to surface over 1.4s. Lists set `aria-busy`.

### Motion and reduced motion
State transitions are 0.12 to 0.15s `ease`. Under `prefers-reduced-motion`, meter, row, button, field and tile transitions are removed and the skeleton stops shimmering.

## Do's and Don'ts

### Do:
- **Do** take every colour from `DS` / `--ds-*` by role; hex lives only in `lib/theme.ts`.
- **Do** set text in the AA roles only (see the contrast table); keep `accent`, `coming`, `cant` and `waiting` for shapes.
- **Do** give each area one filled Rosewood Deep button; make the rest ghost buttons or links.
- **Do** show reply status with the shared four-state vocabulary (face, status, dot, meter) and the `is-attending | is-maybe | is-declined | is-pending` modifiers.
- **Do** keep the header to the page title and one action; add a subtitle (`ds-sub`) only when it helps the task, never as decoration.
- **Do** use tabular figures for counts and skeletons shaped like the content while loading.
- **Do** keep touch targets at 44px (40px for small buttons and the back button) and inputs at 16px text.

### Don't:
- **Don't** mix `T` styles or `components/ui.tsx` pieces with `ds-*` classes inside one page.
- **Don't** add wedding motifs, themed ornaments or a per-wedding colour to the interface (PRODUCT.md principle 5).
- **Don't** set uppercase, letter-spaced eyebrows or kickers above headings; headings are sentence case.
- **Don't** put `waiting-strong` text on `track` (4.41:1) or any text in `accent`, `coming`, `cant` or `waiting`.
- **Don't** add shadows to groups, rows, tasks or tiles; only the lead card and the filled button lift.
- **Don't** show a placeholder zero while data loads.

## Migrating a page

An ordered checklist. Do it only when a task already changes how the page looks, or when asked (CLAUDE.md, "Design system v2").

1. **Opt the page in.** Put `ds` on the page's root element (with `u-main`). Add `ds-wide` if the page has two columns on desktop, then wrap the columns in `ds-split`; for a single list column inside `ds-wide`, wrap it in `ds-narrow`.
2. **Replace `components/ui.tsx` pieces with the ds equivalents:**

   | Incumbent (`components/ui.tsx`) | ds replacement |
   | --- | --- |
   | `Card` | `ds-card` (or `ds-group` of `ds-row` for a list) |
   | `PageHeader` | `ds-header` containing `ds-h1` and `ds-sub`, one action on the right; `ds-back` for a sub-page |
   | `SectionLabel` | `ds-h2`, sentence case (no uppercase eyebrow) |
   | `Button` primary | `ds-btn` (`is-small` in cards and headers) |
   | `Button` secondary | `ds-btn is-ghost`; `ds-link` for a minor action |
   | `Chip` | `ds-chip` with `aria-pressed`, inside `ds-chips` |
   | `StatusPill` | `ds-status` (text) or `ds-face` (avatar) with `is-attending`, `is-maybe`, `is-declined` or `is-pending` |
   | `Avatar` | `ds-face` |
   | `ProgressBar` | `ds-meter` with one `span` per segment (`flex-grow` = count) |
   | `Loading` | `ds-skeleton` blocks shaped like the content, with `aria-busy` |
   | `UnionNote` | a `ds-task` card (icon, title, body, one action) |

   A piece with no ds equivalent yet (for example `Switch`) gets a new `ds-*` class in the v2 section of `app/globals.css`, built from the tokens above, rather than importing the incumbent component into the migrated page.
3. **Colours by role only.** Import `DS` (not `T`) for any inline colour, or use `var(--ds-*)` in CSS. Text only in the AA roles (`ink`, `ink2`, `muted`, `accentStrong`, `comingStrong`, `maybe`, `waitingStrong`).
4. **One filled button per area.** Demote the others to `ds-btn is-ghost` or `ds-link`.
5. **Do not mix systems.** No `T` import, no `components/ui.tsx` import, no incumbent classes left in the page or its child components.
6. **Keep the browser test current.** Update or add the Playwright test of the flow in `apps/web/e2e/` (guest flows at phone size), per CLAUDE.md "Tests"; update selectors that relied on the old components rather than weakening assertions.
7. **Record the migration.** Add the route to the "Migrated so far" list in three places: the Scope note at the top of this file, CLAUDE.md "Design system v2 (page by page)", and the header comment of the v2 section in `app/globals.css`.
