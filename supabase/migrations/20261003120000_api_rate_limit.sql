-- ============================================================
-- Union v1 · Spend limits for /api/translate
--
-- /api/translate forwards a form's copy to a paid model. It requires a
-- signed-in caller, but sign-up is open, so "signed in" alone doesn't bound
-- spend. The route calls consume_translation_quota() before every model call
-- and acts on the answer. Three limits apply, checked in this order:
--
--   1. per user, per hour   (a burst guard)
--   2. per user, per day    (bounds what one account can spend)
--   3. everyone, per day    (bounds what ALL accounts can spend, however many
--                            are made — a circuit breaker, not a quota)
--
-- Design notes:
--   * Counted in Postgres, not in route memory: the route runs on serverless
--     instances that come and go, so a per-process counter would reset at
--     random and could be sidestepped by landing on a fresh instance.
--   * Keyed on auth.uid(), read inside the function, so a caller can't name
--     someone else's counter.
--   * Limits are constants in the function, not parameters. Any signed-in
--     user can call a public RPC directly, so one that took its limit from
--     the caller would be no limit.
--   * The function also checks the caller can edit the form. Without that,
--     any account could call it directly and spend the shared daily budget
--     without ever owning a form. (The route checks this too, through RLS,
--     so it can answer 404; this is the backstop for direct callers.)
--   * Each stage only counts calls that passed the one before it. A user
--     hammering a closed hour doesn't eat their day, and refused calls never
--     touch the global budget — so one account can take at most its own
--     daily allowance from it.
--   * Fixed windows (UTC hours / days): a caller can burst up to twice a
--     limit across a boundary. Fine for a cost ceiling, and each count is
--     one atomic upsert.
--   * The global ceiling turns "unbounded spend" into "translation pauses
--     until tomorrow". Translation is a convenience (the couple can always
--     type the other language), so that is the right way to fail — but it does
--     mean enough accounts, each with a form, can switch the feature off for
--     the day. Raise the constant as real usage grows.
-- ============================================================

create table if not exists union_private.api_rate_limits (
  -- Cascades so deleting an account takes its counters with it.
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create table if not exists union_private.api_global_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- Reachable only through consume_translation_quota(). No policies and no
-- grants: even if this schema were ever exposed over the Data API, nothing
-- could read or write these tables directly.
alter table union_private.api_rate_limits enable row level security;
alter table union_private.api_global_limits enable row level security;
revoke all on union_private.api_rate_limits from public, anon, authenticated;
revoke all on union_private.api_global_limits from public, anon, authenticated;

-- Returns one of:
--   'ok'            the call may go ahead (and has been counted)
--   'no_access'     no signed-in caller, or the caller can't edit this form
--   'user_limit'    this user is over their hourly or daily allowance
--   'global_limit'  everyone together are over today's budget
create or replace function public.consume_translation_quota(p_form_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- One call translates a whole form. Real use is a handful per day: the
  -- largest wedding has 8 forms, and re-running only redoes untouched slots.
  c_user_hour_limit constant integer := 10;
  c_user_day_limit constant integer := 40;
  -- Roughly 10-20x what the whole app uses today. At the route's per-call
  -- size caps this keeps the worst case for a day to a known figure.
  c_global_day_limit constant integer := 200;

  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_hour_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / 3600) * 3600);
  v_day_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / 86400) * 86400);
  v_hits integer;
begin
  if v_user is null or p_form_id is null then
    return 'no_access';
  end if;

  if not exists (
    select 1
    from public.forms f
    where f.id = p_form_id
      and union_private.can_access_wedding(f.wedding_id)
  ) then
    return 'no_access';
  end if;

  -- 1. This user, this hour.
  insert into union_private.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, 'translate/hour', v_hour_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Keep the table from growing forever: drop this caller's expired windows.
  -- Scoped to the caller so it stays a range scan on the primary key.
  delete from union_private.api_rate_limits
  where user_id = v_user
    and window_start < v_now - interval '2 days';

  if v_hits > c_user_hour_limit then
    return 'user_limit';
  end if;

  -- 2. This user, today. Only reached by calls the hour let through.
  insert into union_private.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, 'translate/day', v_day_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if v_hits > c_user_day_limit then
    return 'user_limit';
  end if;

  -- 3. Everyone, today. Only reached by calls both per-user limits let through.
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

revoke all on function public.consume_translation_quota(uuid) from public, anon;
grant execute on function public.consume_translation_quota(uuid) to authenticated;
