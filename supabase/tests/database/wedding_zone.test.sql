begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- The zone is the couple's own phrase on the faire-part. It is shared with
-- guests unless the address is hidden, and a blank phrase is no phrase.
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-0000000000a1', 'zone-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, address_visibility, address_zone, join_code)
values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'Alex', 'Sam', 'area',   'dans le Var', 'zonea1'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', 'Alex', 'Sam', 'hidden', 'dans le Var', 'zonea2'),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a1', 'Alex', 'Sam', 'partial', '   ',        'zonea3');

insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1', 'Shown'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-0000000000a2', 'Hidden'),
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a3', '40000000-0000-0000-0000-0000000000a3', 'Blank');

select is(
  public.get_invitation('40000000-0000-0000-0000-0000000000a1') #>> '{wedding,zone}',
  'dans le Var',
  'the invitation carries the couple''s phrase'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-0000000000a2') #>> '{wedding,zone}',
  null,
  'hidden: the phrase is withheld'
);

select is(
  (select count(*) from jsonb_each_text(public.get_invitation('40000000-0000-0000-0000-0000000000a2')->'wedding') where value like '%Var%'),
  0::bigint,
  'hidden: the phrase appears nowhere in the wedding payload'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-0000000000a3') #>> '{wedding,zone}',
  null,
  'a blank phrase is sent as null'
);

select is(
  public.get_wedding_by_join_code('zonea1') ->> 'zone',
  'dans le Var',
  'the group link carries the phrase'
);

select is(
  public.get_wedding_by_join_code('zonea2') ->> 'zone',
  null,
  'group link, hidden: the phrase is withheld'
);

select throws_ok(
  $$update public.weddings set address_zone = repeat('x', 81) where id = '20000000-0000-0000-0000-0000000000a1'$$,
  '23514',
  null,
  'the phrase is capped at 80 characters'
);

select ok(
  not has_function_privilege('anon', 'public._wedding_zone(public.weddings)', 'execute'),
  'the helper is not callable by guests'
);

select * from finish();
rollback;
