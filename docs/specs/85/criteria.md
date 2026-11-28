# Issue #85 — Acceptance criteria

Built on `strategy.md` (verdict **go**, reading (a) of "solo", confirmed by Arthur) and `design.md` (option A: bare label, D1–D3). Method: `product-designer` Mode B, blocks 2 and 9.

## Summary

On a guest's hub, in « Vos réponses », the RSVP card's meta line (`householdAnswer`, `GuestPortal.tsx:316-322`) shows **the answer label alone** when the invitation has no companions, and **stays exactly as today** (`Prénom : Libellé, …`) when it has companions. The label is the couple's own wording when they wrote one, else Union's default, in the guest's locale. No new string.

## Success (block 2)

- **Primary signal (observable, not a metric):** on a solo invitation that has replied, the card's meta line is exactly the status label: no first name, no colon. Checked by AC-1 to AC-5 and by Arthur on the phone preview (AC-19, manual).
- **Guardrails:** the household line is unchanged (AC-7 to AC-10); the couple's wording is never replaced (AC-3, AC-14); no name of anyone outside the invitation ever appears (AC-16).
- **Contentsquare:** nothing to measure (strategy, "Success signal"). No analytics event is added (AC-18).

## Definitions used by the criteria

- **Solo invitation** — the hub's live `companions` list is empty (strategy reading (a), design D3 / A-D2). [Certain] `companions` is local state initialised from `invitation.companions` and appended to when a partner or child is added during the RSVP (`GuestPortal.tsx:133-135`).
- **RSVP card** — the `FormList` item with key `rsvp`: the `<li>` that contains the heading with the RSVP title (default fr « RSVP de Présence », en "Attendance RSVP"; or the couple's title — the e2e seed stores "RSVP"). Its meta line is the `<p class="gh-card-meta">` (`FormList.tsx:59`).
- **Status label** — `rsvpWording(...)`'s `labelAttending` / `labelMaybe` / `labelDeclined` for the guest's locale: the couple's text if non-blank, else Union's default (fr `Présent` / `Peut-être` / `Absent`, en `Attending` / `Not sure yet` / `Declined`). [Certain] `text.ts:65-86`, `fr.ts:1179-1183`, `en.ts:1225-1227`.
- **Exactly** — the meta element's full text content equals the expected string (not "contains"), so a leftover name, colon or separator fails the test.

## Test layers

- `unit` — vitest + Testing Library, rendering `GuestPortal` (as in `GuestPortal.test.tsx`) or a pure line-building function if the tech lead extracts one (design §7 suggests it). Either is fine as long as the criterion is checked on what the guest sees or on the exact string the card receives.
- `e2e` — Playwright, real app and local Supabase, **phone viewport** (390×844 or a Playwright phone device). [Certain] `playwright.config.ts` uses `Desktop Chrome` today and `guest-forms.spec.ts` has no viewport override, so the new spec must set one (`test.use({ viewport: … })` or a device).
- `db` — none. No schema, RPC or policy change. [Certain] per strategy and design: the line is derived on the client from data `get_invitation` already returns.

---

## Story 1 — A guest invited alone sees their own answer, not their name

**AC-1 — Solo, attending, Union's default labels (main path)** · `unit` + `e2e`
Given a guest « Léa » whose invitation has no companions, whose reply is `attending`, and whose couple has not written custom RSVP labels,
When Léa opens her hub on a phone,
Then the RSVP card's meta line is exactly `Attending` (en) / `Présent` (fr),
And the card shows the done state (`Done` / `Complété`) and the edit button (`Edit` / `Modifier`), as today.

**AC-2 — Solo, each status** · `unit`
Given a solo invitation with Union's default labels,
When the reply is `maybe` (with `allow_rsvp_maybe` on), then `declined`,
Then the meta line is exactly `Not sure yet` / `Peut-être`, then exactly `Declined` / `Absent`.

**AC-3 — Solo, couple's own label (the issue's screenshot)** · `unit` + `e2e`
Given a solo invitation whose couple wrote `Je ne pourrai pas venir` as the declined label (fr) and whose reply is `declined`,
When the guest opens the hub,
Then the meta line is exactly `Je ne pourrai pas venir`: no name, no colon, and the couple's text is not replaced by `Absent` or by any other sentence.
_(e2e: the seed helper needs a way to set `label_declined` on the RSVP form and to seed a `declined` reply; it can seed `declined` already. The e2e may use an English custom label if the e2e locale is en — what matters is a couple label, not the default.)_

**AC-4 — Both locales follow the same rule** · `unit`
Given the same solo, `attending` invitation,
When the hub is rendered with locale `fr`, then with locale `en`,
Then the meta line is exactly `Présent`, then exactly `Attending`, and in neither case does it contain the guest's first name, `:` or a non-breaking space.

**AC-5 — Solo, window closed after replying** · `unit`
Given a solo invitation with reply `attending` and an RSVP form whose `closes_at` is in the past,
When the guest opens the hub,
Then the meta line is exactly the attending label, the state is `Done` / `Complété`, and there is no edit button (unchanged rule, `GuestPortal.test.tsx` "keeps a guest's answer on show…").

**AC-6 — Solo, a stored `maybe` after the couple turned "maybe" off** · `unit`
Given a solo invitation with reply `maybe` and `allow_rsvp_maybe` off,
When the guest opens the hub,
Then the meta line is exactly the maybe label (`Not sure yet` / `Peut-être`, or the couple's maybe label).

## Story 2 — A household keeps the named line (unchanged)

**AC-7 — Companions, all answered** · `unit` + `e2e`
Given an invitation for « Arthur » with one companion « Guinevere », Arthur `attending` and Guinevere `declined`,
When Arthur opens the hub,
Then the meta line is exactly `Arthur : Présent, Guinevere : Absent` (fr, with a non-breaking space U+00A0 before each colon) / `Arthur: Attending, Guinevere: Declined` (en).

**AC-8 — Companions, only the guest answered (reading (a))** · `unit` + `e2e`
Given an invitation for « Arthur » with one companion « Guinevere » who has no reply (`pending`), and Arthur `attending`,
When Arthur opens the hub,
Then the meta line is exactly `Arthur : Présent` (fr) / `Arthur: Attending` (en): the name is kept, and the line is **not** the bare label.

**AC-9 — Companions, couple's labels** · `unit`
Given a household invitation (Arthur `declined`, Guinevere `attending`) whose couple wrote `Je ne pourrai pas venir` and `Je serai là`,
When Arthur opens the hub,
Then the meta line is exactly `Arthur : Je ne pourrai pas venir, Guinevere : Je serai là`.

**AC-10 — Large household** · `unit`
Given an invitation with 11 companions, all answered,
When the guest opens the hub,
Then the meta line lists 12 `Prénom : Libellé` pairs joined by `, `, in the order guest first then companions as returned, with no truncation or ellipsis in the text.
_(Wrapping on screen is covered by AC-13.)_

## Story 3 — The line follows the invitation as it changes

**AC-11 — Solo guest adds a partner during the RSVP** · `unit` (e2e optional)
Given a solo guest « Léa » with `can_add_partner` on, who has not replied,
When she opens the RSVP from the hub, answers `attending`, adds a partner « Hugo » marked `attending`, sends, and returns to the hub **without reloading**,
Then the meta line is exactly `Léa : Présent, Hugo : Présent` (fr) / `Léa: Attending, Hugo: Attending` (en).
_(If driving the whole flow in vitest is too heavy, the tests-first role may cover it in e2e instead; it must be covered by one of the two.)_

**AC-12 — Not replied yet: unchanged** · `unit`
Given a solo invitation and a household invitation, each with the guest's reply `pending`,
When the guest opens the hub,
Then the meta line is the RSVP subtitle (default en "Let us know if you and your companions will join us.", fr « Confirme ta venue et celle de tes proches. », or the couple's subtitle) and the state is `To do` / the closed or "soon" state exactly as today.
_(Guards that the change only touches the replied case. Covered in part by existing tests in `GuestPortal.test.tsx`; the new test must assert the meta text for the solo case at least.)_

## Story 4 — Layout and accessibility on a phone

**AC-13 — Long couple label wraps, no horizontal scroll** · `e2e`
Given a solo invitation, reply `declined`, couple's declined label `Je ne pourrai malheureusement pas être des vôtres ce jour-là`,
When the hub is shown at 390 px wide,
Then the whole label is visible in the card's meta line (its text equals the full label and the element is not clipped: `scrollWidth <= clientWidth`), and the page has no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`).

**AC-14 — Blank couple label falls back to Union's default** · `unit`
Given a solo invitation, reply `attending`, whose couple's `label_attending` is an empty or whitespace-only string,
When the guest opens the hub,
Then the meta line is exactly Union's default (`Attending` / `Présent`), never an empty line.

**AC-15 — Screen-reader structure unchanged** · `unit`
Given a solo invitation that has replied,
When the hub renders,
Then the RSVP card still has its title as a heading (`role="heading"`, level 3) followed by the meta paragraph, and no `aria-label` or extra hidden text re-adds the guest's name to the card.

## Story 5 — Must not happen (privacy and scope)

**AC-16 — No other person's name or answer on a solo card** · `unit` + `e2e`
Given a wedding where guest « Léa » is invited alone and another guest « Pat » (not linked to Léa) has replied `declined`,
When Léa opens her hub,
Then the RSVP card's text contains neither `Pat` nor Pat's answer, and the meta line is exactly Léa's own label.
_(The line is built only from Léa's invitation data; this guards against a future change sourcing names from elsewhere. In e2e, seed both guests in one wedding without a relationship.)_

**AC-17 — Nothing else changes** · `unit`
Given a solo invitation that has replied,
When the hub renders,
Then the hero's reply line (`You'll be with us` / « Tu seras des nôtres » and the other statuses) and the reconfirmation card's meta (its subtitle) are the same as before the change,
And no new string is added to `fr.ts` / `en.ts` (checked by review of the diff, see AC-18).

**AC-18 — No new copy and no analytics** · `manual` (code review)
Given the change set,
When the reviewer reads the diff,
Then `apps/web/lib/i18n/dictionaries/*.ts` has no new or changed key for this line, no analytics/tracking call is added, and `apps/mobile` is untouched.
_Manual because it is a property of the diff, not of behaviour; a test would only restate the diff._

## Story 6 — Owner check

**AC-19 — Reading check on a phone** · `manual`
Given the Vercel preview of the branch,
When Arthur opens a solo guest's hub on his phone, once with the couple's labels (as in the screenshot) and once with Union's default labels and a female first name,
Then the card reads as the guest's own answer, and Arthur decides whether `Présent` alone is acceptable (design Q-D1).
_Manual because it is a judgment on how the wording reads (strategy R1), which no assertion can make. If it jars, the fix is the default label itself, in a separate issue (design D1)._

---

## Coverage map (design → criteria)

| Design item | Criteria |
|---|---|
| §5 Replied, window open — solo / companions | AC-1, AC-2, AC-3 / AC-7, AC-8 |
| §5 Replied, window closed | AC-5 |
| §5 Not replied (todo / closed / soon) | AC-12 |
| §5 RSVP hidden, loading, error, offline, demo, expired link | Not separate criteria: unchanged behaviour, and loading/error/offline are N/A per design. Demo mode uses the same rule (the unit harness renders with `isDemo`, so AC-1–AC-10 run in demo mode). |
| §6 Solo default labels fr / en, maybe | AC-1, AC-2, AC-4 |
| §6 Couple's label | AC-3, AC-9 |
| §6 Stored maybe, option off | AC-6 |
| §6 Solo adds partner | AC-11 |
| §6 Solo adds a child not yet answered for | AC-8 covers the same rule (companions present, only guest answered); no separate test needed. |
| §6 Companions, only guest answered | AC-8 |
| §6 Household of 12 | AC-10, AC-13 (wrapping) |
| §6 Very long couple label | AC-13 |
| §6 Long first name | Covered by AC-1 (solo shows no name at all). |
| §6 Empty first name | Solo: AC-1's "exactly" assertion; see note N2. Household: unchanged, no criterion. |
| §6 Blank couple label | AC-14 |
| §6 200 % zoom | AC-13 checks wrapping at phone width; zoom itself is not tested separately (no fixed height, design §6). |
| §6 Screen reader | AC-15 |
| §7 No motion | No criterion: nothing to assert. |
| §8 No new copy | AC-17, AC-18 |
| Strategy "must cover solo + household" (R3) | AC-1–AC-8 |

## Notes for the next roles

- **N1 — Seed helper gaps.** [Certain] `e2e/support/seed.ts` can only seed `attending` / `declined` replies, has no option for the RSVP form's labels (`label_*`), and no permission flags. AC-3, AC-13 and (if done in e2e) AC-11 need it extended. That is a test-support change, not a weakening.
- **N2 — Empty first name.** [Certain] today a guest with an empty `first_name` on a solo invitation sees ` : Présent`. After the change the solo line is just the label, so AC-1 fixes it for free. I did not add a criterion for the household case: unchanged behaviour, out of scope.
- **N3 — e2e locale.** [Likely] existing e2e tests run in English (they click "Respond to the invitation"). The e2e criteria can assert the English strings; French is covered in `unit` (AC-4, AC-7, AC-8). The tests-first role decides.
- **N4 — Order of names in AC-10.** [Likely] the order is guest first, then `companions` as returned by `get_invitation`. The test should build its expectation from the fixture's order, not assume a sort.

## Contradictions between strategy and design

None blocking. Two points to note:

- **Fallback sentence (R1).** The strategy left open a tutoiement fallback (« Tu seras des nôtres ») for Union's default labels; the design rejected it (D1, option A). The strategy explicitly handed this choice to the designer (Q1), so this is a decision, not a contradiction. The criteria follow the design: the bare label in every case. Arthur's preview check (AC-19) is where it can still be reversed.
- **"Solo" source.** The strategy defines solo as `invitation.companions` empty; the design reads the hub's live `companions` state (D3). Same data at load, and the strategy itself says a partner added mid-RSVP makes the invitation non-solo. Consistent; AC-11 pins the live behaviour.
