# Issue #85 — Strategy

**Verdict: go** (confirmed after checking the screenshot, see "Revision 2"). A small copy fix on the guest hub. It is cheap, easy to undo, and makes the most common screen a guest sees after replying read more naturally. The only real decision is what "solo" means. It is settled below so the designer and PM do not have to guess.

## Revision 2 — screenshot checked (answers Arthur's `/revise`)

Arthur asked me to check the screenshot. I opened it (`attachments/img-01.png`). It shows:

- Section title **« Vos réponses »** with the subtitle « Yyyy, les mariés te poseront quelques questions au fil des préparatifs. » [Certain] These are `hub.formsTitle` and the forms intro in `fr.ts:1091-1093`.
- One card, **« Votre présence »**, with a check-mark badge, the line **« Yyyy : Je ne pourrai pas venir »**, the state **« Complété »** (`hub.statusDone`, `fr.ts:1095`) and a **« Modifier »** button.

So yes: **it is the RSVP card in the hub's forms section, in the "done" state.** A1 is confirmed. The line is `householdAnswer` (`GuestPortal.tsx:314-321`), shown as the card's `meta` (`GuestPortal.tsx:331`). The verdict stays **go**, and the scope stays on that line.

Two things in the screenshot that the first pass did not know, and that change the framing a little:

1. **The couple uses their own wording.** « Votre présence » is not Union's default title (« RSVP de Présence ») and « Je ne pourrai pas venir » is not the default declined label (« Absent ») ([Certain], `fr.ts:1179-1183`). Both come from the couple's custom copy, through `rsvpWording` (`GuestPortal.tsx:246`). So the fix has to work with **any** label, not only the defaults. It does: the change only drops `<name> : ` in front, and it never touches the label.
2. **The label is a first-person sentence.** « Yyyy : Je ne pourrai pas venir » mixes the guest's name in the third person with « je ». Shown alone, « Je ne pourrai pas venir » reads as the guest's own words, which is exactly the point of the issue. This makes the case for the fix stronger than the first pass said. It also makes R1 less of a worry when the couple has custom labels; R1 is still open for the default labels (« Présent » / « Absent »).

The name is also already shown just above, in the section subtitle (« Yyyy, les mariés… ») [Certain]. Repeating it in the card two lines below adds nothing for a solo guest.

What the screenshot cannot tell me: whether Yyyy has a companion who has not replied. With the chosen definition of solo (A2, which Arthur confirmed in an earlier comment), that case keeps the name. The tests must cover both cases.

## Assumptions to check

- **A1 — what the screenshot shows.** Confirmed: see "Revision 2" above.
- **A2 — "solo" means the invitation has no companions** (`invitation.companions` is empty). It does *not* mean "only one person has replied so far". See "Definition of solo" for why. Arthur confirmed this reading in an issue comment.

## Problem

A guest who is invited alone opens their hub after replying. The RSVP card says `Arthur : Présent`. On their own page, which already greets them by name (`hub.greeting`), the name is redundant. It reads like a database row, not a sentence addressed to them. [Certain] The French copy elsewhere speaks to the guest directly ("Tu seras des nôtres", `fr.ts:1083`), so the card's line is out of tone.

The name is there for a reason: on a household invitation the line lists several people (`Arthur : Présent, Guinevere : Absent`), and there the names are needed. The bug is that the same format is used when there is only one person on the invitation.

## Persona

- **Guest invited alone**, on their phone, coming back to the hub after replying. This is the main face of the product. It did not choose the tool, so the product has to feel effortless and personal to them.
- Couple, planner and vendor: not affected.

## Hypothesis

If the RSVP card on a solo invitation shows only the answer (`Présent`) instead of `Arthur : Présent`, then the hub reads as addressed to the guest and looks less like a data dump, because the name adds no information when nobody else is on the invitation.

This is a polish fix, not a bet. The value risk is low, and so is the upside: no metric will move.

## Success signal

- **Observable:** on a solo invitation that has replied, the RSVP card's summary line shows the answer label alone, with no name and no colon. On a household invitation the line is unchanged.
- **Contentsquare:** it cannot measure this in any useful way. The effect is how the screen reads, not a behaviour. A zone-click or rage-click change on this card would be noise. The check is Arthur looking at the preview on a phone.

## Definition of solo (decided here)

Two readings are possible:

| Reading | Example: guest with one companion who hasn't replied yet | Verdict |
|---|---|---|
| (a) The invitation has no companions | Shows `Arthur : Présent` (unchanged) | **Chosen** |
| (b) Only one person appears in the line | Shows `Présent` | Rejected |

Reason: with (b), the household guest sees `Présent` and might read it as "we're all set", even though their companion still has no answer. When the companion replies, the line jumps to a different format (`Arthur : Présent, Guinevere : Absent`). Keeping the name whenever others are on the invitation tells the guest whose answer this is. It also hints that someone is missing. [Likely] (a) is also what the issue's title means ("Si invité solo").

What follows from (a): if a solo guest adds a partner or child during the RSVP (`canAddPartner` / `canAddKids`), the invitation is no longer solo, and the line switches to the named format. That is correct.

## Scope

**In**
- The RSVP card's summary line in the guest hub (`householdAnswer`), primary RSVP, both locales (fr / en).
- On a solo invitation: show the status label alone, with no name and no separator (`Présent`, `Peut-être`, `Absent`, or the couple's custom labels such as `Je ne pourrai pas venir`).
- The tests use at least one custom label (as in the screenshot), not only the defaults.
- The named format stays exactly as it is for invitations with companions.
- A unit test of the line in both cases, and a Playwright check at phone size of the solo case (required by `CLAUDE.md`: this changes `apps/web/app/**`).

**Out**
- The hero's reply line (`gh-replied`: "Tu seras des nôtres"). It already has no name. That it repeats the card is a separate question and not part of this issue.
- Gendered agreement of the default French labels (`Présent` / `Présente`). See risk R1. If it matters, it gets its own issue.
- The reconfirmation card. Its meta is the subtitle, not the household line ([Certain], `GuestPortal.tsx:351`).
- Custom forms' "Answered for 1 of 2" progress line.
- Any change to `RsvpFlow` (the reply flow itself), the couple-side guest list, or exports.
- The native app (`apps/mobile`, on hold).

## Risks

| # | Risk | Probability × impact | Mitigation |
|---|---|---|---|
| R1 | Without a name in front, the bare default label `Présent` reads more like an adjective about the guest, so a woman invited alone may notice the masculine form. With `Arthur : Présent` it read as a status field. | Medium × low | [Guessing] about how readers react. The designer should look at the bare label on a phone. If it jars, the cheapest fix stays inside this scope: reuse the hub's own tutoiement wording for a solo guest instead of the bare label. Changing the default labels is out of scope. Revision 2: this only concerns Union's default labels. When the couple wrote their own labels (as in the screenshot), show them as written: the fallback must never replace the couple's wording. |
| R2 | Too wide a definition of solo (reading b) hides a companion who has not replied. | Low (decided above) × medium | Reading (a), plus a test for "has companions, only the guest has replied → name kept". |
| R3 | The household line has no test today ([Certain]: nothing in `GuestPortal.test.tsx` or `e2e/guest-forms.spec.ts` checks `householdAnswer`), so the change could break the household case without anyone noticing. | Medium × low | Tests cover both cases, as listed under "Scope / In". |

Deadline (June 2027): no impact. This is a few hours of work and easy to undo. Guest data and privacy: no impact. Less is shown, never more.

## Simpler alternatives considered

- **Do nothing.** It works, but this is the guest's first screen after replying, and the fix is tiny. Not worth leaving.
- **Remove the summary line from the card entirely** and rely on the hero's line. It is simpler, but households would lose the per-person view, which is useful. Rejected.
- **Drop the name only for the guest themself on every invitation** (`Présent, Guinevere : Absent`). This mixes two formats in one line and is harder to read. Rejected.

## Open questions (do not block the next stage)

- Q1 (designer): after looking at the bare label at phone size, is it enough, or should a solo guest see the tutoiement wording? See R1.
- Q2 (Arthur): answered. The screenshot matches A1 (see "Revision 2").
- Q3 (out of scope, noted only): in the screenshot the card title says « Votre » (vous) while the subtitle says « te » (tu). The title is the couple's own text, so it is their choice, not a Union bug. No action here.

## What would change my mind

The screenshot check removed the main doubt. Only one thing would still change the verdict: if Arthur meant that a guest with companions should also lose the name when they are the only one who has replied (reading b). He confirmed reading (a), so this is settled unless he says otherwise.
