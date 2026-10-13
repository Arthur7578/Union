-- Union v1 · The zone on the faire-part, written by the couple
--
-- The faire-part front says "En Provence ♡" and its back "te retrouver en
-- Provence". Deriving the preposition from the area ("en", "à") is wrong as
-- soon as the place is "dans le Var" or "aux Baléares", so the couple writes
-- the whole phrase themselves, lower case, as it sits in the sentence.
--
--   * weddings.address_zone — that phrase. Optional: when it is blank the guest
--     UI falls back to the area, then the city (never the country alone).
--   * _wedding_zone(w) — the disclosure rule, next to _wedding_address: the
--     phrase is only sent when the couple shares a location at all, i.e. the
--     address is not hidden.
--   * get_invitation and get_wedding_by_join_code carry it as wedding.zone.

alter table public.weddings
  add column if not exists address_zone text;

alter table public.weddings
  drop constraint if exists weddings_address_zone_length;
alter table public.weddings
  add constraint weddings_address_zone_length
  check (address_zone is null or char_length(address_zone) <= 80);

comment on column public.weddings.address_zone is
  'The place as the couple words it on the faire-part, e.g. "en Provence" or "dans le Var". Shown to guests unless the address is hidden; blank falls back to the area, then the city.';

create or replace function public._wedding_zone(w public.weddings)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when w.address_visibility = 'hidden' then null
    else nullif(btrim(w.address_zone), '')
  end;
$$;

revoke all on function public._wedding_zone(public.weddings) from public;
-- Supabase also grants new functions to these roles directly.
revoke all on function public._wedding_zone(public.weddings) from anon, authenticated;

-- ---------- get_invitation ----------
-- Patched in place, like the other migrations that touch it: the definition
-- the database runs is the sum of several files.
do $migration$
declare
  d text := pg_get_functiondef('public.get_invitation(uuid)'::regprocedure);
begin
  if position('_wedding_zone' in d) > 0 then
    return;
  end if;

  d := replace(
    d,
    $a$'address',            v_address,$a$,
    $a$'address',            v_address,
      'zone',               public._wedding_zone(v_wedding),$a$
  );
  if position('_wedding_zone' in d) = 0 then
    raise exception 'get_invitation no longer has the expected wedding block; patch this migration';
  end if;

  execute d;
end
$migration$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------- get_wedding_by_join_code ----------
-- As in 20261005120000_name_based_group_link, plus 'zone'.
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
    'zone', public._wedding_zone(w),
    'guest_join_auth_mode', w.guest_join_auth_mode,
    'default_locale', w.default_locale
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;
