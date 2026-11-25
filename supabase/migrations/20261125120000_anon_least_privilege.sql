-- Signed-out visitors (anon) get nothing by default; guest RPCs opt in.
--
-- Why: Supabase grants anon, out of the box, every privilege on tables and
-- sequences in public and EXECUTE on every function there (and Postgres
-- itself grants EXECUTE on new functions to PUBLIC, which includes anon).
-- Today only RLS policies keep anon out of the tables, and only each
-- migration's own `revoke` keeps it out of new functions:
-- create_guest_with_links slipped through (20261112120000).
--
-- Guest links and the group link never touch tables directly: they call
-- security definer RPCs that are granted to anon one by one, on purpose.
-- So anon loses:
--   * every privilege on existing tables, views and sequences in public;
--   * the same on tables, views and sequences created later;
--   * EXECUTE on functions created later, unless a migration grants it;
--   * EXECUTE on the two validation helpers it could still call.
-- authenticated and service_role keep their grants.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Supabase's defaults for anon are per schema, so they are removed per
-- schema. PUBLIC's EXECUTE on functions is a global default, so it is
-- removed globally; a function only callable through PUBLIC must now be
-- granted explicitly to the roles that call it.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

revoke execute on function public._guest_modules_valid(jsonb) from public, anon;
revoke execute on function public._rsvp_fields_valid(jsonb) from public, anon;
