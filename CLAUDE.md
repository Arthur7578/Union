# Notes for Claude

## Ideas for later

When the user asks to keep an idea for later, open a GitHub issue and give the user the issue link. Call it an issue, not a pull request.

## Database migrations

Whenever a task needs a schema change, write the migration yourself, without being asked: a timestamped file in `supabase/migrations/` and a matching pgTAP test in `supabase/tests/database/`. Follow the conventions of the user's `/new-migration` skill (you cannot invoke it, it is user-only): `YYYYMMDDHHMMSS_<name>.sql` sorting after the latest migration, a header comment saying what changes and why, RLS and explicit policies on new tables, `search_path` set and `execute` granted narrowly on `security definer` functions, and a test covering the allowed and the denied path.

**Signed-out visitors (`anon`) get nothing unless a migration grants it.** Supabase gives `anon` every table privilege and `EXECUTE` on every function in `public` by default; `create_guest_with_links` was callable signed-out because of that (fixed in `20261112120000`). Since `20261125120000`, `anon` has no table, view or sequence privilege in `public`, and new functions are closed to it (and to `PUBLIC`) by default. Rules:
- Guests never touch tables directly: guest-link and group-link features go through `security definer` RPCs that take `p_token` or `p_join_code` first and are granted to `anon` one by one.
- Keep writing `revoke execute on function … from public, anon;` then `grant … to authenticated` on organiser functions: explicit beats relying on defaults. `create or replace` keeps existing grants.
- A function that relied on the implicit `PUBLIC` grant must now be granted explicitly to the roles that call it.
- The one exception is `keepalive_ping()` (`20261123120000`): the keepalive job calls it with the publishable key, it takes no key and only bumps the one-row `keepalive` table. It is listed apart in the guard test below; do not add others there without a reason written next to them.
- `supabase/tests/database/anon_function_grants.test.sql` fails CI if `anon` can reach a table, or can call a function that has no probe there. A new guest RPC needs a probe line in that file: the test then calls it with an unknown and a null key and fails if it changes data or returns the seeded wedding.

Supabase security traps to check in every migration (from Supabase's own agent checklist, `supabase/agent-skills`):

- A view bypasses RLS unless it is created `with (security_invoker = true)`.
- An UPDATE needs a SELECT policy on the same rows; without one it silently updates 0 rows.
- An UPDATE policy needs both `using` and `with check`, or a user can move a row to someone else.
- Never base an access decision on `user_metadata` / `raw_user_meta_data`: the user can edit it. Use `app_metadata` or a table.
- `auth.role()` is deprecated: target roles with `to authenticated` / `to anon` on the policy, plus an ownership check in `using` (the role alone authorizes every row).

After a schema change, regenerate the shared types: `supabase gen types typescript --local > packages/shared/src/database.types.ts`.

Never apply a migration to a Supabase project (`apply_migration`, DDL through `execute_sql`, `merge_branch`) unless the user explicitly asks in that session. Writing the files is automatic; running them is the user's call. When you hand over, say that the migration has not been applied.

When the user does ask, apply it with the **Apply branch migrations** workflow (`.github/workflows/supabase-migrate.yml`): Claude cannot start it (the GitHub integration gets `403 Resource not accessible by integration` on workflow dispatch, checked 2026-11-25), so ask the user to run it on GitHub (Actions → Apply branch migrations → Run workflow, from `main`, input `branch` = the PR's branch, `dry_run` first if unsure). Then read the run's logs and report what it applied. Do not use `apply_migration`: the Supabase server asks a confirmation question that never reaches the user, and the call times out after 60 seconds. Do not route DDL through `execute_sql` to get around that question either. The workflow applies only the migrations the branch adds compared with main, in one transaction, and skips versions already recorded in production. Since production runs main's code until the merge, a migration applied before merging must not drop or rename anything main still uses.

## Product surface

Web mobile is the main surface: guests and couples use Union on their phone first, desktop second.

The native Expo app (`apps/mobile`) is on hold: no features there unless asked. Put logic that does not depend on the web in `packages/shared`, so the app can reuse it if it restarts. CI keeps the app compiling; if a shared change breaks it, fix the import or type in the same change.

## Tests

The test bank must follow the product, not lag behind it. These rules apply to every change, whether it comes from the squad or from a one-off session. The method, the CI checks and how to run them locally: `docs/testing/README.md`.

- **A change to a screen comes with a browser test.** If you change what a user sees or does (`apps/web/app/**` or `apps/web/components/**`), add or update the Playwright test of that flow in `apps/web/e2e/`. CI enforces it (`test-discipline` workflow, `.github/test-discipline/check.mjs`): the change must be in a `*.spec.ts`; helpers under `e2e/support/`, comments and blank lines do not count.
- **A change to logic comes with a unit test.** `packages/shared/src`, `apps/web/lib`, and the `.ts` files under `apps/web/app` (route handlers, actions): add or update a vitest test under `apps/web` (the only vitest CI runs; tests of `packages/shared` live in `apps/web/lib`). CI enforces it, and reports the share of changed logic lines the unit tests run (diff coverage).
- **A new migration comes with a pgTAP test** (see "Database migrations"). CI enforces it.
- **Every screen has a row in `docs/testing/flows.md`**, naming the tests that cover it or saying it is not covered. A new `page.tsx` needs its row in the same PR; when you add a test, update the row. CI checks every screen is listed and every file named exists.
- Escape labels `no-e2e`, `no-unit`, `no-db-test` are only for changes that cannot affect behavior, and need a line `<label>: <reason>` in the PR description, or CI fails.
- **Guest flows are tested at phone size**, since that is how guests use them: name their spec `guest-*.spec.ts` (or `join-*`, `invitation-*`) and Playwright runs it in the phone project; `couple-*` specs run on phone and desktop, the rest on desktop (`apps/web/playwright.config.ts`).
- **Every acceptance criterion has a test.** When a spec lists criteria (`docs/specs/<issue>/criteria.md`), each one maps to a test, and `docs/specs/<issue>/tests.md` says which. CI checks that the test files and the test names quoted in its table exist.
- **Never weaken a test to make it pass.** If a test is wrong, say why and fix the test in its own commit; do not edit an assertion to match buggy behavior.
- **A bug fix starts with a test that reproduces the bug.** Label the PR `bug`: CI then runs the new test on main's code and fails if it passes there (it would not reproduce the bug).
- **A flaky test is a bug.** CI fails when a browser test only passes on retry. Fix the test or the app; never skip, quarantine or add retries.
- Unit tests (vitest) for logic, pgTAP for the database (see above), Playwright for flows.
- When a PR is ready, the adversarial QA (`qa-adverse` workflow) comments with what it broke and the tests it proposes. It never blocks. The owner keeps tests with `/qa-keep Q1 Q3`; do not copy its proposals into a PR on your own.

## Squad pipeline

Issues labelled `squad` go through an automated product squad (strategist → designer, PM, tech lead → tests first → developer → QA, external reviewer and designer review, in a loop). How it works and how to drive it: `docs/squad/README.md`. Its specs live in `docs/specs/<issue>/`; read them before changing a feature that has one.

## Browser tests without a database (fake Supabase)

Most specs in `apps/web/e2e/` seed a real local Supabase. Specs that only need a signed-in organiser looking at a page use `e2e/support/fakeSupabase.ts` instead: an in-memory stand-in for the Supabase REST and auth API, served through Playwright's network interception, so they need no seeding and each one gets its own data.

- Import `test` and `expect` from `e2e/support/organiser.ts`. It signs the browser in as the organiser of `WEDDING_FIXTURE` and gives each spec a database it can inspect after a click (`supabase.tables.guests`, …). `seating.spec.ts` and `groups.spec.ts` are built on it.
- The fake speaks a small PostgREST subset. If a page asks for something it does not model, the spec fails and lists the request in `supabase.unhandled`: extend the fake or the fixture rather than loosening that check.
- Row-level security, constraints and RPCs are not modelled; that stays with `supabase/tests/database` and the real-database specs.
- Public pages and the guest portal need no data either: the `demo` guest link (`/guest/demo`), sign-in and offline (`guest-demo.spec.ts`, `public-pages.spec.ts`).

`seating` and `groups` are covered: run `e2e/seating.spec.ts` and `e2e/groups.spec.ts` before and after extracting code from them (see below). `GuestPortal` is covered through the demo link and the real-database `guest-*` specs.

## Opportunistic refactors (tech debt)

Three client pages are each one giant component with a lot of local state. Nothing is broken and CI is green, so this is not urgent. Do not split them as a drive-by or in a dedicated refactor: they have no UI tests, so a big restructure is risky.

Instead, **whenever a task already requires changing one of these files, extract the part you are touching** into a child component or a custom hook, in the same change. Keep it small and behavior-preserving, and run lint, typecheck, tests and build before pushing.

Sizes measured on 2026-10-03 (GuestPortal re-measured on 2026-10-09):

| File | Lines | `useState` calls | Notes |
| --- | --- | --- | --- |
| `apps/web/app/guest/[token]/GuestPortal.tsx` | ~590 | 12 | Split on 2026-10-09: RSVP, custom forms and each section now live in sibling files (`RsvpFlow`, `CustomFormFlow`, `TravelSection`, …). The reply email's state lives in `ReplyEmailField.tsx`. What's left is the hub shell and the forms section. Re-measured 2026-10-11 after per-person form answers landed (question steps live in `questionStep.tsx`). Re-measured again 2026-10-11 once the optional maybe reply landed (its wording lookup lives in `rsvpWording`, `lib/i18n/text.ts`). Re-measured 2026-10-21: the RSVP card's answer line is built by `rsvpCardLine` in `packages/shared` (#85). Re-measured 2026-11-03 (~595 lines, no new state): the infos and FAQ sections read the couple's guest page content (`get_guest_page`, helpers in `packages/shared/src/guestPage.ts`). |
| `apps/web/app/(app)/guests/seating/page.tsx` | ~1965 | 22 | One `SeatingPage` function of ~1800 lines. |
| `apps/web/app/(app)/guests/groups/page.tsx` | ~1710 | 20 | One `GroupsPage` function of ~1370 lines. |

When you finish extracting something, update the numbers above. Delete a row once its file is down to a reasonable size.
