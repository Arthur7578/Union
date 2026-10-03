begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- A owns wedding A and its form. B owns a different wedding. C is an active
-- collaborator on A's wedding. D only exists to have no access to anything.
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-0000000000a1', 'quota-a@example.test'),
  ('10000000-0000-0000-0000-0000000000b2', 'quota-b@example.test'),
  ('10000000-0000-0000-0000-0000000000c3', 'quota-c@example.test'),
  ('10000000-0000-0000-0000-0000000000d4', 'quota-d@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'A', 'One'),
  ('20000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000b2', 'B', 'Two');

insert into public.forms (id, wedding_id, title)
values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', 'A form'),
  ('30000000-0000-0000-0000-0000000000b2', '20000000-0000-0000-0000-0000000000b2', 'B form');

insert into public.wedding_collaborators (wedding_id, email, user_id, status)
values (
  '20000000-0000-0000-0000-0000000000a1',
  'quota-c@example.test',
  '10000000-0000-0000-0000-0000000000c3',
  'active'
);

-- The calls below run as a signed-in user, the way the API route makes them.
-- Their answers are recorded here and asserted afterwards as the test owner,
-- so no pgTAP bookkeeping has to run under the restricted role.
create temp table quota_calls (label text not null, answer text);
create temp table quota_facts (name text primary key, value bigint);
grant all on quota_calls to authenticated;

-- ---------- phase 1 ----------
set local role authenticated;

-- A makes 12 calls against an hourly limit of 10.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
insert into quota_calls (label, answer)
select 'a', public.consume_translation_quota('30000000-0000-0000-0000-0000000000a1')
from generate_series(1, 12);
insert into quota_calls (label, answer)
values ('a-null-form', public.consume_translation_quota(null)),
       ('a-missing-form', public.consume_translation_quota('30000000-0000-0000-0000-00000000ffff'));

-- B: their own form, then A's.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
insert into quota_calls (label, answer)
values ('b-own', public.consume_translation_quota('30000000-0000-0000-0000-0000000000b2')),
       ('b-foreign', public.consume_translation_quota('30000000-0000-0000-0000-0000000000a1'));

-- C is on A's team, so A's form is theirs to translate too.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000c3", "role": "authenticated"}';
insert into quota_calls (label, answer)
values ('c-team', public.consume_translation_quota('30000000-0000-0000-0000-0000000000a1'));

-- Nobody signed in.
set local request.jwt.claims = '{}';
insert into quota_calls (label, answer)
values ('anon', public.consume_translation_quota('30000000-0000-0000-0000-0000000000a1'));

reset role;

insert into quota_facts
select 'a_hour_hits', hits from union_private.api_rate_limits
where user_id = '10000000-0000-0000-0000-0000000000a1' and bucket = 'translate/hour';
insert into quota_facts
select 'a_day_hits', hits from union_private.api_rate_limits
where user_id = '10000000-0000-0000-0000-0000000000a1' and bucket = 'translate/day';
insert into quota_facts
select 'global_after_phase_1', hits from union_private.api_global_limits
where bucket = 'translate/day';

-- ---------- phase 2: B has used today's personal allowance ----------
update union_private.api_rate_limits
set hits = 40
where user_id = '10000000-0000-0000-0000-0000000000b2'
  and bucket = 'translate/day';

set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
insert into quota_calls (label, answer)
values ('b-day', public.consume_translation_quota('30000000-0000-0000-0000-0000000000b2'));
reset role;

insert into quota_facts
select 'global_after_phase_2', hits from union_private.api_global_limits
where bucket = 'translate/day';

-- ---------- phase 3: everyone together have used today's budget ----------
update union_private.api_global_limits
set hits = 200
where bucket = 'translate/day';

set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000c3", "role": "authenticated"}';
insert into quota_calls (label, answer)
values ('c-global', public.consume_translation_quota('30000000-0000-0000-0000-0000000000a1'));
reset role;

-- ---------- assertions ----------
select is(
  (select count(*) from quota_calls where label = 'a' and answer = 'ok'),
  10::bigint,
  'a user gets exactly the hourly limit'
);

select is(
  (select count(*) from quota_calls where label = 'a' and answer = 'user_limit'),
  2::bigint,
  'calls past the hourly limit are refused as the user''s own limit'
);

select is(
  (select answer from quota_calls where label = 'b-own'),
  'ok',
  'one user using up their allowance does not affect another'
);

select is(
  (select answer from quota_calls where label = 'b-foreign'),
  'no_access',
  'a form in someone else''s wedding is refused'
);

select is(
  (select answer from quota_calls where label = 'c-team'),
  'ok',
  'a team member can use the allowance on a shared form'
);

select is(
  (select answer from quota_calls where label = 'anon'),
  'no_access',
  'a caller with no identity is refused'
);

select is(
  (select answer from quota_calls where label = 'a-null-form'),
  'no_access',
  'no form is refused'
);

select is(
  (select answer from quota_calls where label = 'a-missing-form'),
  'no_access',
  'a form that does not exist is refused'
);

select is(
  (select value from quota_facts where name = 'a_hour_hits'),
  12::bigint,
  'the hourly counter sees every attempt, refused ones included'
);

select is(
  (select value from quota_facts where name = 'a_day_hits'),
  10::bigint,
  'the daily counter only sees calls the hour let through'
);

select is(
  (select value from quota_facts where name = 'global_after_phase_1'),
  12::bigint,
  'the global budget only sees calls that were allowed (10 + 1 + 1)'
);

select is(
  (select answer from quota_calls where label = 'b-day'),
  'user_limit',
  'a user past their daily allowance is refused'
);

select is(
  (select value from quota_facts where name = 'global_after_phase_2'),
  12::bigint,
  'a call refused for the user''s own limit does not touch the global budget'
);

select is(
  (select answer from quota_calls where label = 'c-global'),
  'global_limit',
  'once everyone together are over the daily budget, calls are refused as such'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'union_private.api_rate_limits',
    'select, insert, update, delete'
  ),
  'signed-in users cannot touch the per-user counters except through the function'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'union_private.api_global_limits',
    'select, insert, update, delete'
  ),
  'signed-in users cannot touch the global counter except through the function'
);

select ok(
  not has_function_privilege('anon', 'public.consume_translation_quota(uuid)', 'execute'),
  'signed-out callers cannot run the quota check'
);

select ok(
  has_function_privilege('authenticated', 'public.consume_translation_quota(uuid)', 'execute'),
  'signed-in users can run the quota check'
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
