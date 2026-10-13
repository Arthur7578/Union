---
name: new-migration
description: Create a new Supabase migration plus a matching pgTAP test, following the project's existing naming and test conventions. Use when the user asks to add a migration, or invokes /new-migration <snake_case_name>.
disable-model-invocation: true
argument-hint: <snake_case_name>
---

Create a new Supabase migration named `$ARGUMENTS` (snake_case; if empty, ask for a name).

## 1. Learn the conventions first (do not assume)

- `ls supabase/migrations | tail -10` and `ls supabase/tests/database`.
- Filename pattern: use the pattern the most recent files follow. Today that is `YYYYMMDDHHMMSS_<name>.sql` (Supabase CLI style); the oldest files used `000N_<name>.sql`, so never copy those. Generate the timestamp with `date -u +%Y%m%d%H%M%S`, and make sure it sorts after the latest existing migration.
- Read the header comment and structure of the latest 1-2 migrations and 1-2 tests so the new files match their tone, comment style and test layout.

## 2. Create the migration

`supabase/migrations/<timestamp>_<name>.sql`, starting with the same kind of header comment as recent migrations: what changes and why. Write idempotent-friendly SQL where the project does. For every new table: enable RLS and add explicit policies. For every new `security definer` function: set `search_path` explicitly and grant `execute` only to the roles that need it. Do not edit existing migrations.

## 3. Create the pgTAP test

`supabase/tests/database/<name>.test.sql`, mirroring the existing tests:

```sql
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(N);

-- fixtures with fixed UUIDs, then assertions (is / isnt / throws_ok / results_eq)

select * from finish();
rollback;
```

Cover at least the new behaviour, and for anything touching RLS or RPCs the denied path as well as the allowed one. Keep `plan(N)` equal to the real assertion count.

## 4. Verify

- If the Supabase CLI and Docker are available: `supabase test db`.
- Otherwise say plainly that the tests were not run (CI runs `supabase test db`).
- If a Supabase MCP project is connected, call `get_advisors` for `security` and `performance` and report RLS or security findings caused by this migration. Do not apply the migration to a remote project unless the user asks.

## 5. Report

List the two files created, the test result (or that it was not run), and any advisor findings.
