begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

-- Allowed path: the keepalive job calls the function with the publishable key.
set local role anon;

select lives_ok(
  $$select public.keepalive_ping()$$,
  'anon (the publishable key) can call keepalive_ping'
);

select is(
  (select ping_count from public.keepalive_ping()),
  2::bigint,
  'each call counts one more ping'
);

-- Denied paths: the table is closed to everyone but the function.
select throws_ok(
  $$select * from public.keepalive$$,
  '42501',
  null,
  'anon cannot read the keepalive table directly'
);

select throws_ok(
  $$update public.keepalive set ping_count = 0$$,
  '42501',
  null,
  'anon cannot write the keepalive table directly'
);

reset role;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000001", "role": "authenticated"}';
set local role authenticated;

select throws_ok(
  $$select public.keepalive_ping()$$,
  '42501',
  null,
  'a signed-in user has no reason to call keepalive_ping and cannot'
);

reset role;

select is(
  (select count(*) from public.keepalive),
  1::bigint,
  'the table never holds more than one row'
);

select * from finish();
rollback;
