-- ============================================================
-- Union v1 · Lock down the team/activity functions
--
-- Postgres grants EXECUTE to PUBLIC on every new function, which for a
-- Supabase project means the anon role can reach them at /rest/v1/rpc/*.
-- None of the functions added in 0026 are meant to be callable by someone
-- who isn't signed in:
--   - the log_* functions only make sense as triggers,
--   - current_actor_label would hand out a couple's first name to anyone
--     who guessed a wedding id,
--   - list_collaborators / accept_pending_invites key off auth.uid() and
--     the session's email, so they're no-ops for anon anyway — but there's
--     no reason to leave them reachable.
-- ============================================================

revoke all on function public.current_actor_label(uuid) from public, anon;
revoke all on function public.log_guest_added() from public, anon;
revoke all on function public.log_rsvp_status_change() from public, anon;
revoke all on function public.log_collaborator_invited() from public, anon;
revoke all on function public.log_collaborator_joined() from public, anon;
revoke all on function public.log_autonomy_change() from public, anon;
revoke all on function public.list_collaborators(uuid) from public, anon;
revoke all on function public.accept_pending_invites() from public, anon;

-- The two the signed-in app actually calls.
grant execute on function public.list_collaborators(uuid) to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;

-- current_actor_label is only ever called from inside the SECURITY DEFINER
-- trigger functions, which run as the owner — nothing needs to reach it
-- over the API.
