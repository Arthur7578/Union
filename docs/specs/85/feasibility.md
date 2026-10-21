# Issue #85 — Feasibility (tech lead)

Inputs read: `strategy.md` (go, reading (a) of "solo"), `design.md` (option A: bare label, D1–D3), `criteria.md` (AC-1 → AC-19), `prototype.html`, the issue screenshot, and the code listed below.

## Verdict

**Feasible as drawn. Effort: S.** [Certain] The change is one branch in one derived string on the client. No schema, RPC, RLS, copy or dependency change. Most of the work is tests (unit for the line, one phone-size Playwright spec, and a small extension of the e2e seed helper).

I would change nothing in the design. I add three implementation choices below (T1–T3) to keep it cheap and safe.

## What the code does today

- [Certain] The line is `householdAnswer` in `apps/web/app/guest/[token]/GuestPortal.tsx:316-322`. It builds `[guest, ...companions]`, drops anyone `pending`, and maps each to `` `${name}${locale === "fr" ? " :" : ":"} ${statusLabel(status)}` ``, joined by `, `. It is passed as the RSVP card's `meta` only when `reply.status !== "pending"` (`:331`); otherwise the meta is `rsvpSubtitle`.
- [Certain] `statusLabel` (`:306-309`) maps a status to `labelAttending` / `labelMaybe` / `labelDeclined`, which come from `rsvpWording(invitation.rsvp_form, locale)` (`lib/i18n/text.ts:65-86`): the couple's text if non-blank (`coupleTextOr`), else Union's default. So AC-14 (blank label → default) already holds and only needs a test.
- [Certain] `companions` is local state (`:135`), initialised from `invitation.companions` and appended to by `onCompanionAdded` (`:545-548`). `reply` is local state too (`:117-120`), replaced by `onSaved`. Both update without reload, so the design's D3 (live "solo") falls out of reading `companions.length` at render.
- [Certain] `FormList.tsx:59` renders the meta as `<p className="gh-card-meta">` under `<h3 className="gh-card-title">`. Nothing in `FormList` changes.
- [Certain] `invitation.companions` comes from `get_invitation` (latest definition: `supabase/migrations/20260821102955_reconfirmation_own_asks.sql`): guests linked **from** this guest in `guest_relationships` (`gr.from_guest = v_guest.id`), `order by c.first_name`. Two consequences:
  - The relation is one-way. If a companion opens **their own** link, their `companions` list is empty, so they see the bare label. That is correct: on their link they only answer for themselves. Nothing to handle, but worth knowing. [Certain] on the SQL, [Likely] that this is the right reading.
  - The household order is guest first, then companions sorted by first name. AC-10 should build its expectation from the fixture in that order (criteria N4 already says so).
- [Certain] No existing test asserts the named line (`GuestPortal.test.tsx`, `locale.test.tsx`, `e2e/guest-forms.spec.ts` checked). Nothing existing should break.

## Data model, migrations, RLS, privacy

- **Data model / migrations:** none. [Certain] Everything the line needs is already in the `get_invitation` payload. No pgTAP test needed (no DB change).
- **RLS / privacy:** none. [Certain] Less is shown, never more. The line is built only from this invitation's `guest` and `companions` (AC-16 holds by construction; the test guards against a future change).
- **Types:** no regeneration of `database.types.ts`.

## Files involved

| File | Change |
|---|---|
| `packages/shared/src/rsvpAnswers.ts` (or a new `packages/shared/src/rsvpCardLine.ts`) | New pure function for the line (T1). |
| `packages/shared/src/index.ts` | Export it. |
| `apps/web/lib/rsvpCardLine.test.ts` (new) | Unit tests of the pure function. Matches the repo pattern: shared logic is tested from `apps/web/lib/*.test.ts` (e.g. `rsvpAnswers.test.ts`), since `packages/shared` has no test runner. [Certain] |
| `apps/web/app/guest/[token]/GuestPortal.tsx` | Replace the inline `householdAnswer` block (7 lines) with a call to the function. Net: a few lines shorter. |
| `apps/web/app/guest/[token]/GuestPortal.test.tsx` | Render-level tests (AC-1, AC-5, AC-11, AC-12, AC-15, AC-17). The `invitation()` fixture needs new options: `rsvpForm` labels for declined/attending, `locale`, and `permissions.can_add_partner` (hard-coded `false` today). |
| `apps/web/e2e/support/seed.ts` | Add an optional `rsvpCopy` (written to `forms.rsvp_copy`, a `jsonb`) and allow seeding `maybe`. Additive; existing specs unaffected. |
| `apps/web/e2e/guest-rsvp-card.spec.ts` (new) | Phone-size spec (390×844) for AC-1, AC-3, AC-7, AC-8, AC-13, AC-16. |
| `CLAUDE.md` | Re-measure the `GuestPortal.tsx` row (required when touching it). |

Not touched: `FormList.tsx`, `RsvpFlow.tsx`, `lib/i18n/dictionaries/*` (AC-18), `apps/mobile`, any migration.

**Large file rule (`CLAUDE.md`):** `GuestPortal.tsx` is on the list. Moving the line-building into a pure shared function *is* the "extract the part you are touching" step: small, behaviour-preserving for households, and it puts web-independent logic in `packages/shared` as `CLAUDE.md` asks. No bigger split.

## Implementation choices (tech lead)

- **T1 — One pure function, owning both formats.** Something like:

  ```ts
  rsvpCardLine({
    guest: { name, status },
    companions: Array<{ name, status }>,   // in display order
    label: (status) => string,             // already resolved by rsvpWording
    locale,                                 // only for the separator
  }): string
  ```

  Rule: `companions.length === 0` → `label(guest.status)`; else today's named list, unchanged. The `pending` case (subtitle) stays in `GuestPortal` where it is today (`:331`), so the function is only called for a replied guest. Labels are passed in already resolved, so the function knows nothing about i18n or the couple's copy: it cannot replace the couple's wording (AC-3, AC-9) and needs no new string (AC-18). [Avis] This is what the design §7 suggested; I confirm `packages/shared` over `apps/web/lib`, because it is pure and the native app shows the same card if it restarts.
- **T2 — "Solo" = the `companions` array passed in is empty**, not "nobody else answered". The function must receive *all* companions (pending included) and filter pending itself for the named format. If the caller pre-filters pending companions, AC-8 (companion pending → name kept) silently breaks. This is the one real trap; the plan will name a unit test for it.
- **T3 — Keep the separator byte-for-byte**: `" :"` in fr, `":"` in en, then a normal space, pairs joined by `", "`. AC-7 asserts the exact string with U+00A0, so a test catches a careless rewrite.

## Performance on a phone

Nothing measurable. [Certain] A string built from at most a dozen entries on render, same as today. No new state, effect, request or bundle dependency.

## Risks

| # | Risk | Likelihood × impact | Mitigation |
|---|---|---|---|
| T-R1 | Pre-filtering pending companions before the solo test (T2) makes a household with an unanswered companion look solo. | Medium × medium | Unit test for AC-8 at function level and at render level. |
| T-R2 | AC-11 in vitest: driving the full RSVP flow (answer → add partner → send → back) is the heaviest test. | Low × low | [Certain] The unit harness renders with `isDemo`, and in demo mode `RsvpFlow` skips both RPCs (`RsvpFlow.tsx:195`, `:261`) and still calls `onCompanionAdded` / `onSaved`. So it is doable in vitest with no Supabase mock change; only the fixture needs `can_add_partner: true`. If it proves brittle, cover the live switch in e2e instead (criteria allows either), but that needs a permissions option in the seed. |
| T-R3 | e2e seed gaps (criteria N1): no custom labels, no `maybe`. | Certain × low | Additive options in `seed.ts`. `rsvp_copy` is a plain `jsonb` column the owner can already write (the seed inserts the form as owner). [Likely] a `{ label_declined: { en: "…" } }` shape works, since `get_invitation` passes `rsvp_copy -> 'label_declined'` straight through and `coupleText` reads localized objects; the developer confirms against `localized.ts`. |
| T-R4 | e2e locale. The existing spec clicks English labels, so guests render in en there. | [Likely] × low | e2e asserts English strings and an English custom label; French strings are covered in unit (AC-4, AC-7, AC-8), as criteria N3 proposes. |
| T-R5 | Playwright project is `Desktop Chrome` with no viewport override. | Certain × low | The new spec sets `test.use({ viewport: { width: 390, height: 844 } })`. Do not change the global config (it would change every existing spec). |
| R1 (strategy) | `Présent` alone may read oddly for a woman invited alone. | Product risk, not technical | Arthur's preview check (AC-19). Reverting to option B later is cheap in code *only* for couples with custom labels; for the defaults it needs to know whether a label is the couple's (`rsvpWording` does not expose that). Option A keeps that door open without building it now. |

## Effort: S

[Likely] Half a day of developer time, most of it in tests:
- Pure function + wiring + CLAUDE.md row: ~1 h.
- Unit tests (function + render, ~15 cases incl. AC-11 flow): ~2 h.
- Seed extension + phone e2e spec: ~1–2 h, plus local Supabase run.

## What I would change in the design

Nothing in the experience. Two notes for the plan stage, neither changes what the guest sees:

1. The criteria allow AC-11 in unit or e2e; I recommend **unit** (demo mode, see T-R2) to keep the e2e seed changes minimal.
2. AC-10 (12 people) and AC-13 (wrapping) are fine; AC-13 checks `scrollWidth <= clientWidth` on the `<p>`, which should hold since `.gh-task-text` has `min-width:0` ([Certain], `GuestPortal.css:119`). Whether the text actually wraps without clipping is [Likely]; the e2e run is the proof.

## Open questions

None blocking. Q-D1 (does `Présent` alone read right) stays with Arthur on the preview.
