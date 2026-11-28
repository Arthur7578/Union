begin;

-- create_guest_with_links is organiser-only (20261112120000): signed-out
-- visitors cannot call it, the wedding's owner can, and a signed-in
-- outsider is refused by the access check.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000080', 'cgwl-owner@example.test'),
  ('10000000-0000-0000-0000-000000000081', 'cgwl-outsider@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, event_date)
values ('20000000-0000-0000-0000-000000000080', '10000000-0000-0000-0000-000000000080', 'Arthur', 'Margot', '2027-06-12');

-- ---------- grants ----------

select ok(
  not has_function_privilege('anon',
    'public.create_guest_with_links(uuid, text, text, text, text, int, text, text, text, uuid[], uuid[], uuid, jsonb, jsonb[])',
    'execute'),
  'a signed-out visitor cannot call create_guest_with_links'
);

select ok(
  has_function_privilege('authenticated',
    'public.create_guest_with_links(uuid, text, text, text, text, int, text, text, text, uuid[], uuid[], uuid, jsonb, jsonb[])',
    'execute'),
  'a signed-in user can still call create_guest_with_links'
);

-- ---------- denied: anon ----------

set local role anon;

select throws_ok(
  $$ select public.create_guest_with_links('20000000-0000-0000-0000-000000000080'::uuid, 'Intruder') $$,
  '42501',
  null,
  'anon gets permission denied when calling it'
);

reset role;

-- ---------- denied: signed-in outsider ----------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000081", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000081';
set local role authenticated;

select throws_ok(
  $$ select public.create_guest_with_links('20000000-0000-0000-0000-000000000080'::uuid, 'Intruder') $$,
  'Not allowed to add guests to this wedding',
  'a signed-in user outside the wedding is refused'
);

reset role;

-- ---------- allowed: owner ----------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000080", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000080';
set local role authenticated;

select is(
  (public.create_guest_with_links('20000000-0000-0000-0000-000000000080'::uuid, 'Claire')).first_name,
  'Claire',
  'the owner can add a guest'
);

reset role;

select * from finish();
rollback;
