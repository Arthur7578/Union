# Notes for Claude

## Opportunistic refactors (tech debt)

Three client pages are each one giant component with a lot of local state. Nothing is broken and CI is green, so this is not urgent. Do not split them as a drive-by or in a dedicated refactor: they have no UI tests, so a big restructure is risky.

Instead, **whenever a task already requires changing one of these files, extract the part you are touching** into a child component or a custom hook, in the same change. Keep it small and behavior-preserving, and run lint, typecheck, tests and build before pushing.

Sizes measured on 2026-10-03:

| File | Lines | `useState` calls | Notes |
| --- | --- | --- | --- |
| `apps/web/app/guest/[token]/GuestPortal.tsx` | ~1878 | 31 | Guest-facing, most state. Best first candidate. |
| `apps/web/app/(app)/guests/seating/page.tsx` | ~1965 | 22 | One `SeatingPage` function of ~1800 lines. |
| `apps/web/app/(app)/guests/groups/page.tsx` | ~1707 | 20 | One `GroupsPage` function of ~1370 lines. |

When you finish extracting something, update the numbers above. Delete a row once its file is down to a reasonable size.

## Known limitations (accepted for now)

### Merging three or more guests (`apps/web/components/MergeReviewPanel.tsx`)

The panel merges a cluster by calling `owner_merge_guests` once per extra guest, each call in its own transaction. Noted on 2026-10-04 and deliberately left as is:

- **Not all-or-nothing.** If one call fails, the calls before it stay committed and the cluster is left half merged (seen with three "Pat" guests before `20261009235900_merge_keeps_one_partner.sql`).
- **The owner's choices only reach the first call.** Later calls get no overrides, so `_merge_guests` can refill a field the owner chose to leave blank from a later guest.

The fix for both is a single RPC that takes the whole cluster plus the overrides and merges it in one transaction. Do it if either problem shows up again, or when this panel is next reworked.
