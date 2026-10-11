# Notes for Claude

## Ideas for later

When the user asks to keep an idea for later, open a GitHub issue and give the user the issue link. Call it an issue, not a pull request.

## End-to-end tests (Playwright)

Browser tests live in `apps/web/e2e/` and run with `npm run test:e2e --workspace apps/web` (CI job `e2e`). They start `next dev` with placeholder Supabase credentials and never contact a real database:

- Public pages and the guest portal need no data: the `demo` guest link (`/guest/demo`), sign-in and offline.
- Organiser pages (`seating`, `groups`, and any `(app)` page) run against `e2e/support/fakeSupabase.ts`, an in-memory stand-in for Supabase served through Playwright's network interception. Import `test` and `expect` from `e2e/support/organiser.ts`: it signs the browser in as the organiser of `WEDDING_FIXTURE` and gives each spec its own database, so a spec can check what a click wrote (`supabase.tables.guests`, …). The fake speaks a small PostgREST subset; if a page asks for something it does not model, the spec fails and lists the request in `supabase.unhandled`. Extend the fake or the fixture rather than loosening that check.
- Row-level security, constraints and RPCs are not modelled; that stays with `supabase/tests/database`.

Run `npx playwright install chromium` once locally, or set `E2E_CHROMIUM_PATH` to an existing Chromium. Running the specs makes `next dev` rewrite `apps/web/next-env.d.ts`; don't commit that change.

`seating` and `groups` are covered, so run `e2e/seating.spec.ts` and `e2e/groups.spec.ts` before and after extracting code from them (see below). `GuestPortal` is covered through the demo link.

## Opportunistic refactors (tech debt)

Three client pages are each one giant component with a lot of local state. Nothing is broken and CI is green, so this is not urgent. Do not split them as a drive-by or in a dedicated refactor: they have no UI tests, so a big restructure is risky.

Instead, **whenever a task already requires changing one of these files, extract the part you are touching** into a child component or a custom hook, in the same change. Keep it small and behavior-preserving, and run lint, typecheck, tests and build before pushing.

Sizes measured on 2026-10-03 (GuestPortal re-measured on 2026-10-09):

| File | Lines | `useState` calls | Notes |
| --- | --- | --- | --- |
| `apps/web/app/guest/[token]/GuestPortal.tsx` | ~500 | 11 | Split on 2026-10-09: RSVP, custom forms and each section now live in sibling files (`RsvpFlow`, `CustomFormFlow`, `TravelSection`, …). The reply email's state lives in `ReplyEmailField.tsx`. What's left is the hub shell and the forms section. |
| `apps/web/app/(app)/guests/seating/page.tsx` | ~1965 | 22 | One `SeatingPage` function of ~1800 lines. |
| `apps/web/app/(app)/guests/groups/page.tsx` | ~1707 | 20 | One `GroupsPage` function of ~1370 lines. |

When you finish extracting something, update the numbers above. Delete a row once its file is down to a reasonable size.
