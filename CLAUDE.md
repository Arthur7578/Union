# Notes for Claude

## Ideas for later

When the user asks to keep an idea for later, open a GitHub issue and give the user the issue link. Call it an issue, not a pull request.

## Database migrations

Whenever a task needs a schema change, write the migration yourself, without being asked: a timestamped file in `supabase/migrations/` and a matching pgTAP test in `supabase/tests/database/`. Follow the conventions of the user's `/new-migration` skill (you cannot invoke it, it is user-only): `YYYYMMDDHHMMSS_<name>.sql` sorting after the latest migration, a header comment saying what changes and why, RLS and explicit policies on new tables, `search_path` set and `execute` granted narrowly on `security definer` functions, and a test covering the allowed and the denied path.

Never apply a migration to a Supabase project (`apply_migration`, DDL through `execute_sql`, `merge_branch`) unless the user explicitly asks in that session. Writing the files is automatic; running them is the user's call. When you hand over, say that the migration has not been applied.

## Product surface

Web mobile is the main surface: guests and couples use Union on their phone first, desktop second. The native Expo app in `apps/mobile` is on hold; do not change it unless asked.

## Tests

The test bank must follow the product, not lag behind it. These rules apply to every change, whether it comes from the squad or from a one-off session.

- **A change to a screen comes with a browser test.** If you change what a user sees or does (`apps/web/app/**` or `apps/web/components/**`), add or update the Playwright test of that flow in `apps/web/e2e/`. CI enforces it (`test-discipline` workflow); the label `no-e2e` is only for changes that cannot affect behavior, with the reason written in the PR.
- **Guest flows are tested at phone size**, since that is how guests use them.
- **Every acceptance criterion has a test.** When a spec lists criteria (`docs/specs/<issue>/criteria.md`), each one maps to a test, and `docs/specs/<issue>/tests.md` says which.
- **Never weaken a test to make it pass.** If a test is wrong, say why and fix the test in its own commit; do not edit an assertion to match buggy behavior.
- **A bug fix starts with a test that reproduces the bug.**
- Unit tests (vitest) for logic, pgTAP for the database (see above), Playwright for flows.

## Squad pipeline

Issues labelled `squad` go through an automated product squad (strategist → designer, PM, tech lead → tests first → developer → QA, external reviewer and designer review, in a loop). How it works and how to drive it: `docs/squad/README.md`. Its specs live in `docs/specs/<issue>/`; read them before changing a feature that has one.

## Opportunistic refactors (tech debt)

Three client pages are each one giant component with a lot of local state. Nothing is broken and CI is green, so this is not urgent. Do not split them as a drive-by or in a dedicated refactor: they have no UI tests, so a big restructure is risky.

Instead, **whenever a task already requires changing one of these files, extract the part you are touching** into a child component or a custom hook, in the same change. Keep it small and behavior-preserving, and run lint, typecheck, tests and build before pushing.

Sizes measured on 2026-10-03 (GuestPortal re-measured on 2026-10-09):

| File | Lines | `useState` calls | Notes |
| --- | --- | --- | --- |
| `apps/web/app/guest/[token]/GuestPortal.tsx` | ~588 | 12 | Split on 2026-10-09: RSVP, custom forms and each section now live in sibling files (`RsvpFlow`, `CustomFormFlow`, `TravelSection`, …). The reply email's state lives in `ReplyEmailField.tsx`. What's left is the hub shell and the forms section. Re-measured 2026-10-11 after per-person form answers landed (question steps live in `questionStep.tsx`). Re-measured again 2026-10-11 once the optional maybe reply landed (its wording lookup lives in `rsvpWording`, `lib/i18n/text.ts`). |
| `apps/web/app/(app)/guests/seating/page.tsx` | ~1965 | 22 | One `SeatingPage` function of ~1800 lines. |
| `apps/web/app/(app)/guests/groups/page.tsx` | ~1710 | 20 | One `GroupsPage` function of ~1370 lines. |

When you finish extracting something, update the numbers above. Delete a row once its file is down to a reasonable size.
