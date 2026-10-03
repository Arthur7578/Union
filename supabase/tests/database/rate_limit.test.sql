begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-0000000000a1', 'rate-limit-a@example.test'),
  ('10000000-0000-0000-0000-0000000000b2', 'rate-limit-b@example.test');

-- The calls below run as a signed-in user, the way the API route makes them.
-- Their outcomes are recorded here and asserted afterwards as the test owner,
-- so no pgTAP bookkeeping has to run under the restricted role.
create temp table rate_limit_calls (
  caller text not null,
  allowed boolean,
  error text
);
grant all on rate_limit_calls to authenticated;

set local role authenticated;

-- User A makes 22 calls against a limit of 20.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
insert into rate_limit_calls (caller, allowed)
select 'a', public.consume_rate_limit('translate')
from generate_series(1, 22);

-- User B's first call, after A has used up the window.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
insert into rate_limit_calls (caller, allowed)
values ('b', public.consume_rate_limit('translate'));

-- A bucket the function doesn't define.
do $$
begin
  perform public.consume_rate_limit('made-up');
exception when others then
  insert into rate_limit_calls (caller, error) values ('bucket', sqlerrm);
end
$$;

-- A caller with no identity.
set local request.jwt.claims = '{}';
insert into rate_limit_calls (caller, allowed)
values ('anon', public.consume_rate_limit('translate'));

reset role;

select is(
  (select count(*) from rate_limit_calls where caller = 'a' and allowed),
  20::bigint,
  'a user gets exactly the bucket limit within one window'
);

select is(
  (select count(*) from rate_limit_calls where caller = 'a' and not allowed),
  2::bigint,
  'calls past the limit are refused'
);

select is(
  (select allowed from rate_limit_calls where caller = 'b'),
  true,
  'one user using up their allowance does not affect another'
);

select is(
  (select allowed from rate_limit_calls where caller = 'anon'),
  false,
  'a caller with no identity is refused'
);

select matches(
  (select error from rate_limit_calls where caller = 'bucket'),
  '^Unknown rate-limit bucket',
  'a bucket the function does not define raises instead of creating one'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'union_private.api_rate_limits',
    'select, insert, update, delete'
  ),
  'signed-in users cannot touch the counters except through the function'
);

select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text)', 'execute'),
  'signed-out callers cannot run the rate limiter'
);

select ok(
  has_function_privilege('authenticated', 'public.consume_rate_limit(text)', 'execute'),
  'signed-in users can run the rate limiter'
);

delete from auth.users where id = '10000000-0000-0000-0000-0000000000a1';

select is(
  (
    select count(*)
    from union_private.api_rate_limits
    where user_id = '10000000-0000-0000-0000-0000000000a1'
  ),
  0::bigint,
  'deleting an account removes its counters'
);

select * from finish();
rollback;
