-- Signed-out visitors can no longer call create_guest_with_links.
--
-- Why: Supabase's default privileges grant EXECUTE on every new function in
-- public to anon, authenticated and service_role. Migration 0016 revoked
-- from PUBLIC only, so anon kept its own grant, and the later
-- `create or replace` (20260814184219) kept it too. The function is
-- security definer and refuses signed-out callers through
-- union_private.can_access_wedding, so nothing was exploitable, but an
-- organiser-only RPC that bypasses RLS should not rest on one internal check.
-- The group link (/join/[code]) does not use this function.

revoke execute on function public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text,
  uuid[], uuid[], uuid, jsonb, jsonb[]
) from public, anon;

grant execute on function public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text,
  uuid[], uuid[], uuid, jsonb, jsonb[]
) to authenticated;
