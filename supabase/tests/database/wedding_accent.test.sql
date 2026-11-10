begin;

-- The couple's wedding colour: a known preset or nothing, set by the
-- wedding's own team and nobody else.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000070', 'accent-owner@example.test'),
  ('10000000-0000-0000-0000-000000000071', 'accent-stranger@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values (
  '20000000-0000-0000-0000-000000000070',
  '10000000-0000-0000-0000-000000000070',
  'Accent',
  'Owner'
);

select is(
  (select accent from public.weddings where id = '20000000-0000-0000-0000-000000000070'),
  null,
  'a new wedding has no colour: Union''s neutral default'
);

select throws_ok(
  $$update public.weddings set accent = '#ff0000' where id = '20000000-0000-0000-0000-000000000070'$$,
  '23514',
  null,
  'a colour that is not one of the presets is refused'
);

-- The owner, signed in.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000070", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000070';
set local role authenticated;

select lives_ok(
  $$update public.weddings set accent = 'terracotta' where id = '20000000-0000-0000-0000-000000000070'$$,
  'the owner can pick a preset'
);

select is(
  (select accent from public.weddings where id = '20000000-0000-0000-0000-000000000070'),
  'terracotta',
  'and it is saved'
);

reset role;

-- Someone with no access to this wedding.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000071", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000071';
set local role authenticated;

update public.weddings set accent = 'navy' where id = '20000000-0000-0000-0000-000000000070';

reset role;

select is(
  (select accent from public.weddings where id = '20000000-0000-0000-0000-000000000070'),
  'terracotta',
  'someone outside the wedding cannot change its colour'
);

select lives_ok(
  $$update public.weddings set accent = null where id = '20000000-0000-0000-0000-000000000070'$$,
  'going back to the neutral default is allowed'
);

select * from finish();
rollback;
