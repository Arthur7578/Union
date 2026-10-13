# Notes for Claude

## Ideas for later

When the user asks to keep an idea for later, open a GitHub issue and give the user the issue link. Call it an issue, not a pull request.

## Database migrations

Whenever a task needs a schema change, write the migration yourself, without being asked: a timestamped file in `supabase/migrations/` and a matching pgTAP test in `supabase/tests/database/`. Follow the conventions of the user's `/new-migration` skill (you cannot invoke it, it is user-only): `YYYYMMDDHHMMSS_<name>.sql` sorting after the latest migration, a header comment saying what changes and why, RLS and explicit policies on new tables, `search_path` set and `execute` granted narrowly on `security definer` functions, and a test covering the allowed and the denied path.

Never apply a migration to a Supabase project (`apply_migration`, DDL through `execute_sql`, `merge_branch`) unless the user explicitly asks in that session. Writing the files is automatic; running them is the user's call. When you hand over, say that the migration has not been applied.

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
