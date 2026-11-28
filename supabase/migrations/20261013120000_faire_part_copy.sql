-- Union v1 · The couple's own wording of the faire-part
--
-- The card a guest opens first has default wording per language, built into
-- the app. This lets the couple replace any line of it, per language, and have
-- the other language machine-translated for review.
--
--   * weddings.faire_part_copy — slot → language → template, e.g.
--       {"greeting": {"fr": "Cher {{guest_first_name}},", "$auto": ["en"], "en": "Dear {{guest_first_name}},"}}
--     A missing slot or language means "use the default". The fields a
--     template may name are filled in by the guest's browser from what the
--     invitation already discloses, so nothing new is exposed: the text itself
--     is what the couple chose to tell every guest.
--   * get_invitation and get_wedding_by_join_code carry it as
--     wedding.faire_part_copy.
--   * consume_wedding_translation_quota — the same allowance as
--     consume_translation_quota, for a request scoped to the wedding rather
--     than to one of its forms (the card has no form row).

alter table public.weddings
  add column if not exists faire_part_copy jsonb not null default '{}'::jsonb;

alter table public.weddings
  drop constraint if exists weddings_faire_part_copy_shape;
alter table public.weddings
  add constraint weddings_faire_part_copy_shape
  check (
    jsonb_typeof(faire_part_copy) = 'object'
    and pg_column_size(faire_part_copy) <= 20000
  );

comment on column public.weddings.faire_part_copy is
  'The couple''s wording of the faire-part: slot -> language -> template ({{fields}} and [optional parts]). Missing slots and languages use the app''s default text.';

-- ---------- get_invitation ----------
-- Patched in place, like the other migrations that touch it: the definition
-- the database runs is the sum of several files.
do $migration$
declare
  d text := pg_get_functiondef('public.get_invitation(uuid)'::regprocedure);
begin
  if position('faire_part_copy' in d) > 0 then
    return;
  end if;

  d := replace(
    d,
    $a$'address',            v_address,$a$,
    $a$'address',            v_address,
      'faire_part_copy',    v_wedding.faire_part_copy,$a$
  );
  if position('faire_part_copy' in d) = 0 then
    raise exception 'get_invitation no longer has the expected wedding block; patch this migration';
  end if;

  execute d;
end
$migration$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------- get_wedding_by_join_code ----------
-- As in 20261005120000_name_based_group_link, plus 'faire_part_copy'.
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
    'faire_part_copy', w.faire_part_copy,
    'guest_join_auth_mode', w.guest_join_auth_mode,
    'default_locale', w.default_locale
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;

-- ---------- translation allowance, scoped to a wedding ----------
-- Returns the same answers as consume_translation_quota ('ok', 'no_access',
-- 'user_limit', 'global_limit') and counts against the same buckets, so the
-- per-user and everyone-per-day ceilings cover forms and the card together.
-- The limits are repeated from that function: change them in both.
create or replace function public.consume_wedding_translation_quota(p_wedding_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_user_hour_limit constant integer := 10;
  c_user_day_limit constant integer := 40;
  c_global_day_limit constant integer := 200;

  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_hour_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / 3600) * 3600);
  v_day_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / 86400) * 86400);
  v_hits integer;
begin
  if v_user is null or p_wedding_id is null then
    return 'no_access';
  end if;

  if not union_private.can_access_wedding(p_wedding_id) then
    return 'no_access';
  end if;

  insert into union_private.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, 'translate/hour', v_hour_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  delete from union_private.api_rate_limits
  where user_id = v_user
    and window_start < v_now - interval '2 days';

  if v_hits > c_user_hour_limit then
    return 'user_limit';
  end if;

  insert into union_private.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, 'translate/day', v_day_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if v_hits > c_user_day_limit then
    return 'user_limit';
  end if;

  insert into union_private.api_global_limits as g (bucket, window_start, hits)
  values ('translate/day', v_day_start, 1)
  on conflict (bucket, window_start)
  do update set hits = g.hits + 1
  returning g.hits into v_hits;

  delete from union_private.api_global_limits
  where window_start < v_now - interval '2 days';

  if v_hits > c_global_day_limit then
    return 'global_limit';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.consume_wedding_translation_quota(uuid) from public, anon;
grant execute on function public.consume_wedding_translation_quota(uuid) to authenticated;
