# Issue #85 — Tests per acceptance criterion

`unit-line` = `apps/web/lib/rsvpCardLine.test.ts` (the pure `rsvpCardLine` from `packages/shared`).
`unit-hub` = `apps/web/app/guest/[token]/GuestPortal.test.tsx`, describe "GuestPortal's RSVP card once the guest has replied (#85)".
`e2e` = `apps/web/e2e/guest-rsvp-card.spec.ts`, at 390×844.

| AC | Test(s) |
|---|---|
| AC-1 solo, attending, default labels | unit-line "is the answer alone…"; unit-hub "shows a guest invited alone their answer…" (Done + Edit too); e2e "a guest invited alone sees their answer, not their name" |
| AC-2 solo, each status | unit-line "is the answer alone…" (all three, fr and en); unit-hub "shows each answer alone, a maybe included" |
| AC-3 solo, couple's label | unit-line "is the couple's own wording…"; unit-hub "shows the couple's own wording… (the issue's screenshot)"; e2e "…the couple's own wording, in full, on a phone" (English custom label) |
| AC-4 both locales | unit-line "is the answer alone…" (fr/en); unit-hub "shows a guest invited alone…" (en) and "does the same in French" |
| AC-5 window closed | unit-hub "keeps the answer on show alone after the RSVP closes" |
| AC-6 stored maybe, option off | unit-hub "shows each answer alone, a maybe included" (third case) |
| AC-7 household, all answered | unit-line "names each person…" (exact fr string with U+00A0, and en); unit-hub "keeps one name per person for a household"; e2e "a household keeps one name per person" |
| AC-8 household, companion pending | unit-line "keeps the guest's name when a companion has not been answered for yet"; unit-hub "keeps the guest's name while a companion hasn't been answered for"; e2e "a guest whose partner hasn't been answered for keeps their name" |
| AC-9 household, couple's labels | unit-line "uses the couple's wording for every person" |
| AC-10 household of 12 | unit-line "lists a large household in full…" |
| AC-11 solo adds a partner, no reload | unit-hub "names everyone once a guest invited alone adds a partner, without a reload" (demo mode drives the real RsvpFlow) |
| AC-12 not replied yet | unit-hub "shows the subtitle, not an answer, before the guest replies" |
| AC-13 long label wraps, no sideways scroll | e2e "…the couple's own wording, in full, on a phone" |
| AC-14 blank couple label | unit-hub "falls back to Union's label when the couple's is blank" |
| AC-15 screen-reader structure | unit-hub: every card test finds the card by its level-3 heading; "adds no hidden text that puts the guest's name back on the card" (no `aria-label`, no name in the card's text) |
| AC-16 no other person's name | e2e "a guest invited alone sees their answer, not their name" (unlinked guest Pat seeded in the same wedding); unit-hub "adds no hidden text…" |
| AC-17 nothing else changes | unit-hub "leaves the hero's reply line as it was"; existing GuestPortal tests unchanged and green |
| AC-18 no new copy, no analytics | manual: the diff touches no dictionary, no tracking call, nothing in `apps/mobile` |
| AC-19 reading check on a phone | manual: Arthur on the Vercel preview |

Unit-line also covers design §6 "empty first name" ("does not show a stray colon…").
