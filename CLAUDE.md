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

The test bank must follow the product, not lag behind it. These rules apply to every change, whether it comes from the squad or from a one-off session.

- **A change to a screen comes with a browser test.** If you change what a user sees or does (`apps/web/app/**` or `apps/web/components/**`), add or update the Playwright test of that flow in `apps/web/e2e/`. CI enforces it (`test-discipline` workflow); the label `no-e2e` is only for changes that cannot affect behavior, with the reason written in the PR.
- **Guest flows are tested at phone size**, since that is how guests use them. In `apps/web/playwright.config.ts`, files named `guest-*.spec.ts` or `join-*.spec.ts` also run in the `phone` project (emulated Pixel 7, touch); name a new guest flow test that way.
- **Production is checked too, read-only** (`apps/web/e2e-prod/`, workflow **Production checks**, daily and after each **Apply branch migrations** run): signed-out access, guest RPCs, the guest and group links on a phone, every organiser page signed in, and the sign-in captcha's configuration. When you add an organiser page, add its path to `e2e-prod/organiser.spec.ts`. These tests must never write wedding data. They sign in with a one-time code made by the secret key, because a bot cannot pass the captcha.
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
| `apps/web/app/guest/[token]/GuestPortal.tsx` | ~590 | 12 | Split on 2026-10-09: RSVP, custom forms and each section now live in sibling files (`RsvpFlow`, `CustomFormFlow`, `TravelSection`, …). The reply email's state lives in `ReplyEmailField.tsx`. What's left is the hub shell and the forms section. Re-measured 2026-10-11 after per-person form answers landed (question steps live in `questionStep.tsx`). Re-measured again 2026-10-11 once the optional maybe reply landed (its wording lookup lives in `rsvpWording`, `lib/i18n/text.ts`). Re-measured 2026-10-21: the RSVP card's answer line is built by `rsvpCardLine` in `packages/shared` (#85). Re-measured 2026-11-03 (~595 lines, no new state): the infos and FAQ sections read the couple's guest page content (`get_guest_page`, helpers in `packages/shared/src/guestPage.ts`). |
| `apps/web/app/(app)/guests/seating/page.tsx` | ~1965 | 22 | One `SeatingPage` function of ~1800 lines. |
| `apps/web/app/(app)/guests/groups/page.tsx` | ~1710 | 20 | One `GroupsPage` function of ~1370 lines. |

When you finish extracting something, update the numbers above. Delete a row once its file is down to a reasonable size.
