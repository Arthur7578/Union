-- ============================================================
-- Union v1 · Show a guest the email the couple has for them (issue #77)
--
-- A guest without an email is asked for one when they reply. Once it is on
-- file, the RSVP form used to drop the field entirely, so a guest coming back
-- to their reply couldn't tell whether the couple had their address.
--
-- get_guest_email_status now also returns email_hint: the address with its
-- local part masked ("j•••@gmail.com"). Enough for the guest to recognise
-- their address and spot a wrong domain, without handing the full address to
-- whoever opened the invitation: in light mode, anyone who knows a guest's
-- name can.
-- ============================================================

create or replace function public._email_hint(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(trim(coalesce(p_email, '')), '') is null then null
    -- No usable "@": reveal nothing.
    when position('@' in trim(p_email)) < 2 then '•••'
    else left(trim(p_email), 1) || '•••'
         || substring(trim(p_email) from position('@' in trim(p_email)))
  end;
$$;

revoke all on function public._email_hint(text) from public, anon, authenticated;

create or replace function public.get_guest_email_status(p_token uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'status', 'ok',
    'email_missing', nullif(trim(g.email), '') is null,
    'email_hint', public._email_hint(g.email)
  )
  from public.guests g
  where g.invite_token = p_token;
$$;

revoke all on function public.get_guest_email_status(uuid) from public;
grant execute on function public.get_guest_email_status(uuid) to anon, authenticated;
