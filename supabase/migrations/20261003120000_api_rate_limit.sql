-- ============================================================
-- Union v1 · Per-user rate limiting for server routes that spend money
--
-- /api/translate forwards a form's copy to a paid model. It already requires
-- a signed-in caller, but sign-up is open, so "signed in" alone doesn't bound
-- spend. This adds a counter the route consults before it calls the model.
--
-- Design notes:
--   * Counted in Postgres, not in route memory: the route runs on serverless
--     instances that come and go, so a per-process counter would reset at
--     random and could be sidestepped by landing on a fresh instance.
--   * Keyed on auth.uid(), read inside the function — a caller can't name
--     someone else's counter or pass a spoofed id.
--   * The buckets and their limits are fixed in the function. A signed-in
--     user can call any public RPC directly, so a function that took the
--     limit or the bucket name from its caller would let them mint unbounded
--     bucket rows. Unknown buckets raise instead.
--   * Fixed windows: a caller can burst up to twice the limit across a window
--     boundary. That is fine for a cost ceiling and keeps this one atomic
--     upsert.
-- ============================================================

create table if not exists union_private.api_rate_limits (
  -- Cascades so deleting an account takes its counters with it.
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Reachable only through consume_rate_limit(). No policies and no grants:
-- even if this schema were ever exposed over the Data API, nothing could
-- read or write the table directly.
alter table union_private.api_rate_limits enable row level security;
revoke all on union_private.api_rate_limits from public, anon, authenticated;

-- Returns true when the call is within the limit, false when it is not.
-- Every call is counted, including refused ones, so hammering a closed
-- window doesn't buy anything.
create or replace function public.consume_rate_limit(p_bucket text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_hits integer;
begin
  if v_user is null then
    return false;
  end if;

  case p_bucket
    -- One call translates a whole form. Real use is a handful per hour.
    when 'translate' then
      v_limit := 20;
      v_window_seconds := 3600;
    else
      raise exception 'Unknown rate-limit bucket: %', p_bucket;
  end case;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );

  insert into union_private.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Keep the table from growing forever: drop this caller's expired windows.
  -- Scoped to the caller so it stays an index range scan on the primary key.
  delete from union_private.api_rate_limits
  where user_id = v_user
    and window_start < now() - interval '1 day';

  return v_hits <= v_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
