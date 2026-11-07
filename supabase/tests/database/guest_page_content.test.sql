begin;

-- The couple's guest page content (20261103120000): the couple and their
-- co-organisers write it, nobody else does, guests read it only through
-- get_guest_page, and the shuttle waits for a household yes.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

-- Two weddings, each with an owner. Wedding A has a household (an invited
-- guest and their partner) and a guest who declined; wedding B is someone
-- else's.
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000070', 'page-owner@example.test'),
  ('10000000-0000-0000-0000-000000000071', 'page-outsider@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, event_date)
values
  ('20000000-0000-0000-0000-000000000070', '10000000-0000-0000-0000-000000000070', 'Arthur', 'Margot', '2027-06-12'),
  ('20000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-000000000071', 'Other', 'Couple', '2027-07-01');

insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-000000000070', '20000000-0000-0000-0000-000000000070', '40000000-0000-0000-0000-000000000070', 'Claire'),
  ('30000000-0000-0000-0000-000000000071', '20000000-0000-0000-0000-000000000070', '40000000-0000-0000-0000-000000000071', 'Her partner'),
  ('30000000-0000-0000-0000-000000000072', '20000000-0000-0000-0000-000000000070', '40000000-0000-0000-0000-000000000072', 'Declined guest');

insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
values ('20000000-0000-0000-0000-000000000070', '30000000-0000-0000-0000-000000000070', '30000000-0000-0000-0000-000000000071', 'partner_of');

insert into public.rsvps (guest_id, status)
values ('30000000-0000-0000-0000-000000000072', 'declined');

insert into public.room_blocks (id, wedding_id, name, price_note, note, status)
values (
  '60000000-0000-0000-0000-000000000070',
  '20000000-0000-0000-0000-000000000070',
  'Hôtel des Oliviers', '120 € la nuit · 10 min', 'Acompte versé', 'Complet'
);

-- ---------- the tables are closed by default ----------

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.oid in ('public.guest_pages'::regclass, 'public.guest_page_moments'::regclass, 'public.guest_page_faq'::regclass)),
  'row level security is on for all three tables'
);

select ok(
  not has_function_privilege('anon', 'public._localized_text_valid(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public._palette_valid(jsonb)', 'execute'),
  'guests cannot call the validation helpers'
);

select ok(
  has_function_privilege('anon', 'public.get_guest_page(uuid)', 'execute'),
  'a guest link can call get_guest_page'
);

-- ---------- the owner writes ----------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000070", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000070';
set local role authenticated;

select lives_ok(
  $$insert into public.guest_pages (wedding_id, welcome, travel_train, shuttle, dress_code, palette)
    values (
      '20000000-0000-0000-0000-000000000070',
      '{"fr": "Il y a huit ans…", "en": "Eight years ago…"}',
      '{"fr": "Gare d''Avignon TGV"}',
      '{"fr": "Navette à 15 h depuis la gare"}',
      '{"fr": "Chic champêtre"}',
      '[{"color": "#A4AE8F", "name": {"fr": "Sauge"}}, {"color": "#5D6A3E"}]'
    )$$,
  'the owner saves the page texts and palette'
);

select lives_ok(
  $$insert into public.guest_page_moments (wedding_id, day_offset, starts_at, title, place)
    values
      ('20000000-0000-0000-0000-000000000070', 0, '16:30', '{"fr": "La cérémonie"}', '{"fr": "Sous les oliviers"}'),
      ('20000000-0000-0000-0000-000000000070', -1, '19:30', '{"fr": "Le dîner du vendredi"}', null),
      ('20000000-0000-0000-0000-000000000070', 1, null, '{"fr": "Brunch"}', null)$$,
  'the owner adds moments on the day before, the day and the day after'
);

select lives_ok(
  $$insert into public.guest_page_faq (wedding_id, question, answer, sort_order)
    values
      ('20000000-0000-0000-0000-000000000070', '{"fr": "Qui contacter ?"}', '{"fr": "Léa, notre témoin"}', 1),
      ('20000000-0000-0000-0000-000000000070', '{"fr": "Les enfants ?"}', '{"fr": "Bienvenus"}', 0)$$,
  'the owner adds questions'
);

select is(
  (select count(*) from public.guest_page_moments where wedding_id = '20000000-0000-0000-0000-000000000070'),
  3::bigint,
  'the owner reads back their moments'
);

-- ---------- what the database refuses ----------

select throws_ok(
  $$insert into public.guest_page_moments (wedding_id, day_offset, title)
    values ('20000000-0000-0000-0000-000000000070', 0, '{"fr": "   "}')$$,
  '23514', null,
  'a moment with no title in any language is refused'
);

select throws_ok(
  $$insert into public.guest_page_moments (wedding_id, day_offset, title)
    values ('20000000-0000-0000-0000-000000000070', 5, '{"fr": "Trop tard"}')$$,
  '23514', null,
  'a moment more than three days from the wedding is refused'
);

select throws_ok(
  $$insert into public.guest_page_faq (wedding_id, question, answer)
    values ('20000000-0000-0000-0000-000000000070', '{"fr": "Une question"}', '{}')$$,
  '23514', null,
  'a question without an answer is refused'
);

select throws_ok(
  $$update public.guest_pages set welcome = '{"fr": 42}' where wedding_id = '20000000-0000-0000-0000-000000000070'$$,
  '23514', null,
  'text that is not a locale map of strings is refused'
);

select throws_ok(
  $$update public.guest_pages set palette = '[{"color": "olive"}]' where wedding_id = '20000000-0000-0000-0000-000000000070'$$,
  '23514', null,
  'a palette colour that is not #RRGGBB is refused'
);

select throws_ok(
  $$update public.guest_pages
      set palette = '[{"color":"#000000"},{"color":"#000000"},{"color":"#000000"},{"color":"#000000"},{"color":"#000000"},{"color":"#000000"},{"color":"#000000"}]'
    where wedding_id = '20000000-0000-0000-0000-000000000070'$$,
  '23514', null,
  'a palette of more than six colours is refused'
);

reset role;

-- ---------- someone else's wedding ----------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000071", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000071';
set local role authenticated;

select is(
  (select count(*) from public.guest_pages where wedding_id = '20000000-0000-0000-0000-000000000070'),
  0::bigint,
  'another couple cannot read this wedding''s page'
);

select is(
  (select count(*) from public.guest_page_moments where wedding_id = '20000000-0000-0000-0000-000000000070')
  + (select count(*) from public.guest_page_faq where wedding_id = '20000000-0000-0000-0000-000000000070'),
  0::bigint,
  'another couple cannot read this wedding''s moments or questions'
);

select throws_ok(
  $$insert into public.guest_page_moments (wedding_id, day_offset, title)
    values ('20000000-0000-0000-0000-000000000070', 0, '{"fr": "Intrus"}')$$,
  '42501', null,
  'another couple cannot add a moment to this wedding'
);

update public.guest_pages set dress_code = '{"fr": "Pyjama"}'
where wedding_id = '20000000-0000-0000-0000-000000000070';

reset role;

select is(
  (select dress_code ->> 'fr' from public.guest_pages where wedding_id = '20000000-0000-0000-0000-000000000070'),
  'Chic champêtre',
  'another couple''s update changed nothing'
);

-- ---------- a guest link, outside the RPC ----------

set local request.jwt.claims = '';
set local request.jwt.claim.sub = '';
set local role anon;

select throws_ok(
  $$select count(*) from public.guest_page_moments$$,
  '42501', null,
  'a guest cannot read the moments table directly'
);

select throws_ok(
  $$select count(*) from public.guest_pages$$,
  '42501', null,
  'a guest cannot read the page table directly'
);

-- ---------- what get_guest_page returns ----------

select throws_ok(
  $$select public.get_guest_page('40000000-0000-0000-0000-0000000000ff')$$,
  'P0001', 'Invalid invitation token',
  'an unknown link gets an error, not an empty page'
);

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000070') #>> '{page,welcome,fr}',
  'Il y a huit ans…',
  'a guest reads the couple''s word'
);

select is(
  (select array_agg(m ->> 'starts_at' order by ord) from jsonb_array_elements(
    public.get_guest_page('40000000-0000-0000-0000-000000000070') -> 'moments'
  ) with ordinality as t(m, ord)),
  array['19:30', '16:30', null],
  'moments come in order: day before, the day, day after, with times as HH:MM'
);

select is(
  (select array_agg(f #>> '{question,fr}' order by ord) from jsonb_array_elements(
    public.get_guest_page('40000000-0000-0000-0000-000000000070') -> 'faq'
  ) with ordinality as t(f, ord)),
  array['Les enfants ?', 'Qui contacter ?'],
  'questions come in the couple''s order'
);

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000070') -> 'stays',
  '[{"id": "60000000-0000-0000-0000-000000000070", "name": "Hôtel des Oliviers", "price_note": "120 € la nuit · 10 min"}]'::jsonb,
  'stays carry the name and price line, never the couple''s note or status'
);

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000070') #> '{page,shuttle}',
  'null'::jsonb,
  'the shuttle is withheld before the household says yes'
);

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000072') #> '{page,shuttle}',
  'null'::jsonb,
  'the shuttle is withheld from a guest who declined'
);

reset role;

-- The partner says yes: the household has a yes on record.
insert into public.rsvps (guest_id, status)
values ('30000000-0000-0000-0000-000000000071', 'attending');

set local role anon;

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000070') #>> '{page,shuttle,fr}',
  'Navette à 15 h depuis la gare',
  'the shuttle shows once someone in the household says yes'
);

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000072') #> '{page,shuttle}',
  'null'::jsonb,
  'another household''s yes does not unlock it for a guest who declined'
);

reset role;

-- A wedding with nothing written yet: the guest gets empty lists and no
-- page, which the hub reads as "nothing to show".
insert into public.guests (id, wedding_id, invite_token, first_name)
values ('30000000-0000-0000-0000-000000000073', '20000000-0000-0000-0000-000000000071', '40000000-0000-0000-0000-000000000073', 'Guest of B');

set local role anon;

select is(
  public.get_guest_page('40000000-0000-0000-0000-000000000073'),
  '{"page": null, "moments": [], "faq": [], "stays": []}'::jsonb,
  'a wedding with nothing written returns an empty page'
);

reset role;

-- Deleting a wedding takes its page with it.
delete from public.weddings where id = '20000000-0000-0000-0000-000000000070';

select is(
  (select count(*) from public.guest_page_moments where wedding_id = '20000000-0000-0000-0000-000000000070')
  + (select count(*) from public.guest_pages where wedding_id = '20000000-0000-0000-0000-000000000070'),
  0::bigint,
  'deleting a wedding deletes its page content'
);

select * from finish();
rollback;
