begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(39);

-- ---------- the normaliser ----------
-- A number is canonicalised only if it states its country. National
-- formats are never guessed, because the same digits belong to different
-- countries.

select is(public._normalize_guest_phone('+31 6 12345678'), '+31612345678',
  'a + number is canonicalised');
select is(public._normalize_guest_phone('0031 6 12345678'), '+31612345678',
  'a 00 prefix is an explicit international number');
select is(public._normalize_guest_phone('(+31) 6 12345678'), '+31612345678',
  'a + that is not the first character still counts');
select is(public._normalize_guest_phone('tel:+1 (415) 555-2671'), '+14155552671',
  'punctuation and a tel: prefix are ignored');

select is(public._normalize_guest_phone('415-555-2671'), null,
  'a US number without + is not read as anything');
select is(public._normalize_guest_phone('07911 123456'), null,
  'a UK mobile without + is not read as anything');
select is(public._normalize_guest_phone('0612345678'), null,
  'a mobile without + is not read as French (or Dutch)');
select is(public._normalize_guest_phone('06 12 34 56 78'), null,
  'a French national number without + is not read as anything either');

-- The bracketed trunk digit is not part of the number.
select is(public._normalize_guest_phone('+33 (0)6 12 34 56 78'), '+33612345678',
  'the (0) in +33 (0)6 is dropped');
select is(public._normalize_guest_phone('+33(0)612345678'), '+33612345678',
  'the (0) is dropped without spaces');
select is(public._normalize_guest_phone('+44 (0) 7911 123456'), '+447911123456',
  'the (0) is dropped for any country, with spaces inside the brackets');
select is(public._normalize_guest_phone('+31 (0)6 12345678'), '+31612345678',
  'the (0) is dropped for a Dutch number');
select is(public._normalize_guest_phone('+33 06 12 34 56 78'), '+330612345678',
  'an unbracketed 0 is left alone: it cannot be told from a digit');

select is(public._normalize_guest_phone('+0612345678'), null,
  'no country code starts with 0');
select is(public._normalize_guest_phone('+1234567'), null,
  'too few digits is rejected');
select is(public._normalize_guest_phone('+1234567890123456'), null,
  'more than 15 digits is rejected');
select is(public._normalize_guest_phone(null), null, 'null stays null');
select is(public._normalize_guest_phone('   '), null, 'blank stays null');

-- ---------- the legacy reading ----------
-- Exactly what the system did to a stateless number before: read it as
-- French. It exists only to keep already-saved numbers findable.
select is(public._legacy_french_phone_reading('06 12 34 56 78'), '+33612345678',
  'legacy: a French national number');
select is(public._legacy_french_phone_reading('6 12 34 56 78'), '+33612345678',
  'legacy: a French number without the trunk 0');
select is(public._legacy_french_phone_reading('33612345678'), '+33612345678',
  'legacy: a French number with the country code but no +');
select is(public._legacy_french_phone_reading('415-555-2671'), null,
  'legacy: a US number is still not read as French');
select is(public._legacy_french_phone_reading('+0612345678'), null,
  'legacy: a number that states a country is never reinterpreted as French, even if malformed');
select is(public._legacy_french_phone_reading('0033 6 12 34 56 78'), null,
  'legacy: a 00 prefix states a country too');

-- ---------- fixtures ----------
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'phone-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, join_code)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Mixed', 'Wedding', 'phone-mixed');

insert into public.guests (id, wedding_id, invite_token, first_name, phone)
values
  -- saved before the picker: national format, country not stated
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 'Camille', '06 12 34 56 78'),
  -- saved by the picker: states its country
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000002', 'Daan', '+31612345678'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000003', 'Uma', '+14155552671'),
  -- national format that was never French: nothing can honestly read it
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000004', 'Olivia', '07911 123456');

-- ---------- the stored columns ----------
select is((select phone_e164 from public.guests where first_name = 'Daan'), '+31612345678',
  'a number that states its country is stored canonically');
select is((select phone_e164_legacy_fr from public.guests where first_name = 'Daan'), null,
  'and never also gets a legacy reading');
select is((select phone_e164 from public.guests where first_name = 'Camille'), null,
  'a stateless number has no canonical form');
select is((select phone_e164_legacy_fr from public.guests where first_name = 'Camille'),
  '+33612345678',
  'but keeps its old French reading, visibly marked as legacy');
select is((select phone_e164_legacy_fr from public.guests where first_name = 'Olivia'), null,
  'a stateless number that was never French gets no reading at all');

-- ---------- a generated column is written by the role doing the writing ----------
-- 20260812 fixed guest INSERTs failing with "permission denied for
-- function" because `authenticated` could not run the normaliser.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select lives_ok(
  $$insert into public.guests (wedding_id, first_name, phone)
    values ('20000000-0000-0000-0000-000000000001', 'Written as the owner', '+33 (0)7 98 76 54 32')$$,
  'an authenticated owner can insert a guest (the helpers stay executable)');
reset role;
select is((select phone_e164 from public.guests where first_name = 'Written as the owner'),
  '+33798765432',
  'and the value written by that role is canonical');

-- ---------- contact-first join ----------
-- The apps send E.164, so the typed side always states its country.
select is(public.find_guest_by_contact('phone-mixed', '+31 6 12 34 56 78') ->> 'token',
  '40000000-0000-0000-0000-000000000002',
  'a Dutch guest typing +31 reaches their own row, not the French guest with the same digits');
select is(public.find_guest_by_contact('phone-mixed', '+14155552671') ->> 'token',
  '40000000-0000-0000-0000-000000000003',
  'a US guest typing +1 finds themselves');
select is(public.find_guest_by_contact('phone-mixed', '+33612345678') ->> 'token',
  '40000000-0000-0000-0000-000000000001',
  'a number saved before the picker is still found by its stated-country form');
select is(public.find_guest_by_contact('phone-mixed', '06 12 34 56 78') ->> 'status',
  'not_found',
  'a number typed without a country is never read as French');
select is(public.find_guest_by_contact('phone-mixed', '+447911123456') ->> 'status',
  'not_found',
  'a stateless saved number that was never French cannot be matched by guess');

-- ---------- verified Auth phone ----------
-- GoTrue stores the confirmed number without its "+".
insert into auth.users (id, email, phone, phone_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000002', 'dutch-guest@example.test', '31612345678', now()),
  ('10000000-0000-0000-0000-000000000003', 'french-guest@example.test', '33612345678', now());

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is(
  (select jsonb_array_length(public.get_guest_access_options('phone-mixed') -> 'matches')),
  1,
  'a verified +31 phone finds exactly the Dutch guest');
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000002') ->> 'status', 'verified',
  'a verified +31 phone can claim the guest stored with +31');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000001') ->> 'status', 'verified',
  'a verified +33 phone can still claim a guest saved before the picker');

select * from finish();
rollback;
