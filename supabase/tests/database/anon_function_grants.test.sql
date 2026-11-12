begin;

-- Guard: signed-out visitors (anon) can only call the security definer
-- functions that guest links and the group link need.
--
-- Supabase's default privileges grant EXECUTE on every new function in
-- public to anon, so `revoke … from public` alone leaves it callable
-- (see CLAUDE.md, "Database migrations"). If this test fails on a new
-- function: add `revoke execute on function … from public, anon;` to its
-- migration. Only if signed-out guests really must call it, add it to the
-- list below.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(1);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in (
        -- group link (/join/[code])
        'get_wedding_by_join_code',
        'find_guest_for_join',
        'check_join_email',
        -- guest link (/guest/[token]) and RSVP
        'get_invitation',
        'get_invitation_rsvp_forms',
        'get_guest_page',
        'get_guest_email_status',
        'mark_welcome_seen',
        'set_guest_email',
        'set_guest_locale',
        'submit_rsvp',
        'submit_rsvp_response',
        'submit_companion_rsvp',
        'submit_form_response',
        'rsvp_register_companion',
        'rsvp_merge_into'
      )
  $$,
  'only guest-link and group-link security definer functions are callable by anon'
);

select * from finish();
rollback;
