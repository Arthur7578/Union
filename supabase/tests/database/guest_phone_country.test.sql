begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

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
   '40000000-0000-0000-0000-000000000004', 'Olivia', '07911 123456'),
  -- an email-only guest: no phone at all
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000006', 'Emil', null),
  -- a French guest saved by the picker: French numbers keep working
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000005', 'Claire', '+33 6 98 76 54 32');

update public.guests set email = 'emil@example.test' where first_name = 'Emil';

-- ---------- the stored column ----------
select is((select phone_e164 from public.guests where first_name = 'Daan'), '+31612345678',
  'a number that states its country is stored canonically');
select is((select phone_e164 from public.guests where first_name = 'Claire'), '+33698765432',
  'a French number saved with its country is stored canonically');
select is((select phone_e164 from public.guests where first_name = 'Camille'), null,
  'a number that states no country has no canonical form (it is not read as French)');
select is((select phone from public.guests where first_name = 'Camille'), '06 12 34 56 78',
  'and its text is left exactly as it was saved');
select is((select phone_e164 from public.guests where first_name = 'Olivia'), null,
  'a national number from anywhere else has none either');

-- ---------- a generated column is written by the role doing the writing ----------
-- 20260812 fixed guest INSERTs failing with "permission denied for
-- function" because `authenticated` could not run the normaliser: a stored
-- generated column is recomputed as the writing role. Checked directly,
-- because a role-level insert would also depend on table grants and RLS
-- policies that differ between environments.
select is(has_function_privilege('authenticated', 'public._normalize_guest_phone(text)', 'EXECUTE'), true,
  'authenticated can run the normaliser, so it can write a guest');
select is(has_function_privilege('service_role', 'public._normalize_guest_phone(text)', 'EXECUTE'), true,
  'and so can the service role');
select is(has_function_privilege('anon', 'public._normalize_guest_phone(text)', 'EXECUTE'), false,
  'but anon cannot call it directly');

-- ---------- contact-first join ----------
-- The apps send E.164, so the typed side always states its country.
select is(public.find_guest_by_contact('phone-mixed', '+31 6 12 34 56 78') ->> 'token',
  '40000000-0000-0000-0000-000000000002',
  'a Dutch guest typing +31 reaches their own row, not the French guest with the same digits');
select is(public.find_guest_by_contact('phone-mixed', '+14155552671') ->> 'token',
  '40000000-0000-0000-0000-000000000003',
  'a US guest typing +1 finds themselves');
select is(public.find_guest_by_contact('phone-mixed', '+33698765432') ->> 'token',
  '40000000-0000-0000-0000-000000000005',
  'a French guest saved with their country is found by it');
select is(public.find_guest_by_contact('phone-mixed', '+33612345678') ->> 'status',
  'not_found',
  'a guest saved before the picker, with no country, is not found by a guessed one');
select is(public.find_guest_by_contact('phone-mixed', '06 12 34 56 78') ->> 'status',
  'not_found',
  'a number typed without a country is never read as French');
select is(public.find_guest_by_contact('phone-mixed', '+447911123456') ->> 'status',
  'not_found',
  'a saved number with no country is not matched by guess, whatever country it might be');

-- ---------- verified Auth phone ----------
-- GoTrue stores the confirmed number without its "+".
insert into auth.users (id, email, phone, phone_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000002', 'dutch-guest@example.test', '31612345678', now()),
  ('10000000-0000-0000-0000-000000000003', 'french-guest@example.test', '33612345678', now()),
  ('10000000-0000-0000-0000-000000000004', 'claire@example.test', '33698765432', now());

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is(
  (select jsonb_array_length(public.get_guest_access_options('phone-mixed') -> 'matches')),
  1,
  'a verified +31 phone finds exactly the Dutch guest');
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000002') ->> 'status', 'verified',
  'a verified +31 phone can claim the guest stored with +31');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000001') ->> 'status', 'not_available',
  'a verified phone does not claim a guest whose saved number states no country');

-- A confirmed phone is not an identity for a guest it does not match. With a
-- null phone_e164 the comparison was null rather than false and the claim
-- went through.
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000006') ->> 'status', 'not_available',
  'a verified phone cannot claim an email-only guest');
select is((select profile_id from public.guests where first_name = 'Emil'), null,
  'and the guest is left unclaimed');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000005') ->> 'status', 'verified',
  'a verified +33 phone claims the French guest saved with their country');

select * from finish();
rollback;
