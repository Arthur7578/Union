-- ============================================================
-- Union v1 · The invitation welcome ("faire-part")
--
-- 1. guests.welcome_seen_at: whether this guest has opened the welcome that
--    greets them before the hub. Kept server-side so it follows the guest to
--    another device. get_invitation reports it; mark_welcome_seen sets it.
--
-- 2. A group link discloses where the wedding is exactly as a guest's own link
--    does. get_wedding_by_join_code used to return venue_name whatever the
--    tier, so the two disagreed. _wedding_address and _wedding_venue_name now
--    state the tiers once for the join RPC (get_invitation still carries the
--    same rules inline; they are kept identical).
--    NOTE: a group link no longer reveals the venue name when the couple has
--    not chosen the 'full' tier.
--
-- get_invitation is patched in place from its live definition rather than
-- redefined: several migrations have changed it, and rewriting it from an
-- older copy would silently drop their fields.
-- ============================================================

alter table public.guests
  add column if not exists welcome_seen_at timestamptz;

comment on column public.guests.welcome_seen_at is
  'When this guest first opened the invitation welcome. Null until they do; the welcome is shown once, and the guest hub can replay it.';

-- ---------- shared disclosure rules ----------
create or replace function public._wedding_address(w public.weddings)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case w.address_visibility
    when 'full' then jsonb_build_object(
      'line',         w.address_line,
      'postal_code',  w.address_postal_code,
      'city',         w.address_city,
      'area',         null,
      'country',      w.address_country
    )
    when 'partial' then jsonb_build_object(
      'line',         null,
      'postal_code',  w.address_postal_code,
      'city',         w.address_city,
      'area',         null,
      'country',      w.address_country
    )
    when 'area' then jsonb_build_object(
      'line',         null,
      'postal_code',  null,
      'city',         null,
      'area',         w.address_area,
      'country',      w.address_country
    )
    else null
  end;
$$;

create or replace function public._wedding_venue_name(w public.weddings)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when w.address_visibility = 'full' then w.venue_name else null end;
$$;

revoke all on function public._wedding_address(public.weddings) from public;
revoke all on function public._wedding_venue_name(public.weddings) from public;
-- Supabase also grants new functions to these roles directly.
revoke all on function public._wedding_address(public.weddings) from anon, authenticated;
revoke all on function public._wedding_venue_name(public.weddings) from anon, authenticated;

-- ---------- get_invitation: add guest.welcome_seen_at to the payload ----------
do $migration$
declare
  d text := pg_get_functiondef('public.get_invitation(uuid)'::regprocedure);
begin
  if position('welcome_seen_at' in d) > 0 then
    return;
  end if;
  d := replace(
    d,
    '''chosen_locale'', v_guest.chosen_locale,',
    '''chosen_locale'', v_guest.chosen_locale,' || E'\n        ' || '''welcome_seen_at'', v_guest.welcome_seen_at,'
  );
  if position('welcome_seen_at' in d) = 0 then
    raise exception 'get_invitation no longer has the expected guest block; patch this migration';
  end if;
  execute d;
end
$migration$;

-- ---------- get_wedding_by_join_code: same disclosure as a guest's own link ----------
create or replace function public.get_wedding_by_join_code(p_join_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'partner_one', w.partner_one,
    'partner_two', w.partner_two,
    'event_date', w.event_date,
    'venue_name', public._wedding_venue_name(w),
    'address_visibility', w.address_visibility,
    'address', public._wedding_address(w),
    'guest_join_auth_mode', w.guest_join_auth_mode,
    'default_locale', w.default_locale
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;

-- ---------- mark_welcome_seen ----------
-- Idempotent: the first call stamps the time, later ones change nothing.
create or replace function public.mark_welcome_seen(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.guests
     set welcome_seen_at = coalesce(welcome_seen_at, now())
   where invite_token = p_token
   returning id into v_id;
  if v_id is null then
    raise exception 'Invalid invitation token';
  end if;
  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.mark_welcome_seen(uuid) from public;
grant execute on function public.mark_welcome_seen(uuid) to anon, authenticated;
