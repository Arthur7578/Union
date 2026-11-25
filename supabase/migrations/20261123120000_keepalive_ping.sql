-- ============================================================
-- Union v1 · A heartbeat the keepalive job can write
--
-- What changes:
--   * public.keepalive          one row, the last time the job pinged
--                               and how many times it has.
--   * public.keepalive_ping()   updates that row and returns it.
--                               The only way in: the table itself
--                               has RLS on and no policy.
--
-- Why: Supabase paused the Free project on 2026-11-23 although the
-- GitHub keepalive job had made one REST read every day since
-- 2026-11-03, each answered 200 (seen in the edge logs). That read
-- returned an empty list (RLS) and was evidently not counted as
-- enough user activity. The job now makes several requests per run,
-- one of them this real write, so Postgres does work Supabase can see.
--
-- Callable with the publishable key (role anon), since that is the
-- only key the job holds. Anyone who has that public key can bump
-- the counter: harmless, the table never grows past one row.
-- ============================================================

create table public.keepalive (
  id         smallint primary key default 1 check (id = 1),
  pinged_at  timestamptz not null default now(),
  ping_count bigint not null default 0
);

comment on table public.keepalive is
  'One row written by the GitHub keepalive job so the Free project is not paused for inactivity.';

alter table public.keepalive enable row level security;
-- No policy on purpose: nobody reads or writes the table directly.
revoke all on table public.keepalive from public, anon, authenticated;

insert into public.keepalive (id) values (1);

create function public.keepalive_ping()
returns table (pinged_at timestamptz, ping_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    update public.keepalive k
       set pinged_at = now(),
           ping_count = k.ping_count + 1
     where k.id = 1
 returning k.pinged_at, k.ping_count;
end;
$$;

comment on function public.keepalive_ping() is
  'Called by .github/workflows/supabase-keepalive.yml. Updates the single keepalive row.';

revoke all on function public.keepalive_ping() from public, anon, authenticated;
grant execute on function public.keepalive_ping() to anon;
