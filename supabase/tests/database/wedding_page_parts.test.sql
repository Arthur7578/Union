begin;

-- The wedding page parts (20261107190000): the guest modules map takes the
-- page's part keys, and every part may be off.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000090', 'parts-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values ('20000000-0000-0000-0000-000000000090', '10000000-0000-0000-0000-000000000090', 'Arthur', 'Margot');

-- ---------- allowed ----------

select lives_ok(
  $$ update public.weddings
        set guest_modules = '{"word": false, "weekend": false, "venue": false, "travel": false, "dress": false, "faq": false}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  'every part can be turned off: the page is then the faire-part and the reply'
);

select lives_ok(
  $$ update public.weddings
        set guest_modules = '{"dress": true, "travel": false}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  'a part can be stored on or off'
);

select lives_ok(
  $$ update public.weddings set guest_modules = '{}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  'an empty map is every part on'
);

-- ---------- refused ----------

select throws_ok(
  $$ update public.weddings set guest_modules = '{"logistics": false}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514', null,
  'the old logistics key is refused: it is now weekend and venue'
);

select throws_ok(
  $$ update public.weddings set guest_modules = '{"forms": false}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514', null,
  'the forms key is refused: the reply is always on the page'
);

select throws_ok(
  $$ update public.weddings set guest_modules = '{"word": "no"}'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514', null,
  'a value that is not a boolean is refused'
);

select throws_ok(
  $$ update public.weddings set guest_modules = '["word"]'
      where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514', null,
  'a value that is not an object is refused'
);

-- ---------- the guest link sees the map ----------

insert into public.guests (id, wedding_id, invite_token, first_name)
values ('30000000-0000-0000-0000-000000000090', '20000000-0000-0000-0000-000000000090', '40000000-0000-0000-0000-000000000090', 'Claire');

update public.weddings set guest_modules = '{"travel": false}'
 where id = '20000000-0000-0000-0000-000000000090';

set local role anon;
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000090') #> '{wedding,guest_modules}',
  '{"travel": false}'::jsonb,
  'the invitation carries the parts the couple turned off'
);
reset role;

select * from finish();
rollback;
