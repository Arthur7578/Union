begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- A owns a wedding with a customised card; B has no access to it.
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-0000000000f1', 'card-a@example.test'),
  ('10000000-0000-0000-0000-0000000000f2', 'card-b@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, join_code, faire_part_copy)
values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', 'Alex', 'Sam', 'cardf1',
   '{"greeting": {"fr": "Cher {{guest_first_name}},", "$auto": ["en"], "en": "Dear {{guest_first_name}},"}}'),
  ('20000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000f2', 'Kim', 'Lee', 'cardf2', default);

insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1', '40000000-0000-0000-0000-0000000000f1', 'Guest');

select is(
  public.get_invitation('40000000-0000-0000-0000-0000000000f1') #>> '{wedding,faire_part_copy,greeting,fr}',
  'Cher {{guest_first_name}},',
  'the invitation carries the couple''s wording'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-0000000000f1') #> '{wedding,faire_part_copy,greeting,$auto}',
  '["en"]'::jsonb,
  'and which languages are machine-translated'
);

select is(
  public.get_wedding_by_join_code('cardf1') #>> '{faire_part_copy,greeting,en}',
  'Dear {{guest_first_name}},',
  'the group link carries it too'
);

select is(
  public.get_wedding_by_join_code('cardf2') -> 'faire_part_copy',
  '{}'::jsonb,
  'a wedding that never customised the card sends an empty object'
);

select throws_ok(
  $$update public.weddings set faire_part_copy = '[]'::jsonb where id = '20000000-0000-0000-0000-0000000000f1'$$,
  '23514',
  null,
  'the wording must be an object'
);

select throws_ok(
  $$update public.weddings set faire_part_copy = jsonb_build_object('greeting', repeat('x', 25000)) where id = '20000000-0000-0000-0000-0000000000f1'$$,
  '23514',
  null,
  'and is capped in size'
);

-- The translation allowance: the owner may spend it, a stranger may not.
create temp table quota_calls (label text not null, answer text);
grant all on quota_calls to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
insert into quota_calls values ('owner', public.consume_wedding_translation_quota('20000000-0000-0000-0000-0000000000f1'));
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';
insert into quota_calls values ('stranger', public.consume_wedding_translation_quota('20000000-0000-0000-0000-0000000000f1'));
reset role;

select is((select answer from quota_calls where label = 'owner'), 'ok', 'the owner may translate their card');
select is((select answer from quota_calls where label = 'stranger'), 'no_access', 'someone else''s account may not spend on it');

select * from finish();
rollback;
