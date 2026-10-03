begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

-- ---------- the normaliser ----------
-- A national number means nothing without a country: the wedding's region
-- decides, and a region we have no rules for yields null rather than a guess.

select is(public._normalize_guest_phone('415-555-2671', 'US'), '+14155552671',
  'a US number without + is read as US in a US wedding');
select is(public._normalize_guest_phone('415-555-2671', 'FR'), null,
  'the same US number is not guessed into France');
select is(public._normalize_guest_phone('415-555-2671', null), null,
  'with no region a national number is left alone');
select is(public._normalize_guest_phone('1 (415) 555-2671', 'US'), '+14155552671',
  'a US number with its trunk 1 is read as US');
select is(public._normalize_guest_phone('155-555-2671', 'US'), null,
  'a 10-digit US number cannot start with 1');

select is(public._normalize_guest_phone('07911 123456', 'GB'), '+447911123456',
  'a UK mobile without + is read as UK in a UK wedding');
select is(public._normalize_guest_phone('07911 123456', 'FR'), null,
  'the same UK mobile is not guessed into France');

select is(public._normalize_guest_phone('0612345678', 'NL'), '+31612345678',
  'a Dutch mobile is read as Dutch in a Dutch wedding');
select is(public._normalize_guest_phone('0612345678', 'FR'), '+33612345678',
  'identical digits are French in a French wedding: the region decides');
select isnt(public._normalize_guest_phone('0612345678', 'NL'),
            public._normalize_guest_phone('0612345678', 'FR'),
  'the two readings of the same digits never collapse into one identity');

select is(public._normalize_guest_phone('0612345678', 'DE'), null,
  'a region without rules yields null, not a guess');
select is(public._normalize_guest_phone('0612345678', 'fr '), '+33612345678',
  'the region is case- and whitespace-insensitive');

-- Numbers that already say where they are need no region at all.
select is(public._normalize_guest_phone('+31 6 12345678', 'FR'), '+31612345678',
  'an explicit + number ignores the wedding region');
select is(public._normalize_guest_phone('+31 6 12345678', null), '+31612345678',
  'an explicit + number needs no region');
select is(public._normalize_guest_phone('0031 6 12345678', null), '+31612345678',
  'a 00 prefix is an explicit international number');
select is(public._normalize_guest_phone('(+31) 6 12345678', null), '+31612345678',
  'a + that is not the first character still counts');
select is(public._normalize_guest_phone('+0612345678', 'FR'), null,
  'no country code starts with 0');
select is(public._normalize_guest_phone('+1234567', 'US'), null,
  'too few digits is rejected');
select is(public._normalize_guest_phone('+1234567890123456', 'US'), null,
  'more than 15 digits is rejected');

-- What worked before keeps working for French weddings.
select is(public._normalize_guest_phone('06 12 34 56 78', 'FR'), '+33612345678',
  'a French national number is unchanged');
select is(public._normalize_guest_phone('6 12 34 56 78', 'FR'), '+33612345678',
  'a French number without the trunk 0 is unchanged');
select is(public._normalize_guest_phone('33612345678', 'FR'), '+33612345678',
  'a French number with the country code but no + is unchanged');

-- ---------- fixtures ----------
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'phone-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, join_code, phone_region)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Paris', 'Wedding', 'phone-fr', 'FR'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Dutch', 'Wedding', 'phone-nl', 'NL'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'Boston', 'Wedding', 'phone-us', 'US');

insert into public.guests (id, wedding_id, invite_token, first_name, phone)
values
  -- French wedding: a French guest and a Dutch guest who was given a "+".
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 'Camille', '06 12 34 56 78'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000002', 'Daan', '+31 6 12345678'),
  -- Dutch wedding: national format.
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002',
   '40000000-0000-0000-0000-000000000003', 'Sanne', '0612345678'),
  -- US wedding: national format.
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003',
   '40000000-0000-0000-0000-000000000004', 'Uma', '415-555-2671');

-- ---------- phone_e164 follows the wedding ----------
select is((select phone_e164 from public.guests where first_name = 'Camille'), '+33612345678',
  'a guest in a French wedding is stored as French');
select is((select phone_e164 from public.guests where first_name = 'Sanne'), '+31612345678',
  'identical digits in a Dutch wedding are stored as Dutch');
select is((select phone_e164 from public.guests where first_name = 'Uma'), '+14155552671',
  'a guest in a US wedding is stored as US');

-- A client cannot write the canonical value directly; it is always recomputed.
update public.guests set phone_e164 = '+33999999999' where first_name = 'Daan';
select is((select phone_e164 from public.guests where first_name = 'Daan'), '+31612345678',
  'a value written straight to phone_e164 is overwritten');

update public.guests set phone = '07 98 76 54 32' where first_name = 'Camille';
select is((select phone_e164 from public.guests where first_name = 'Camille'), '+33798765432',
  'changing the phone recomputes the canonical value');

-- Changing the region re-reads the guests already stored.
update public.weddings set phone_region = 'FR' where id = '20000000-0000-0000-0000-000000000002';
select is((select phone_e164 from public.guests where first_name = 'Sanne'), '+33612345678',
  'changing the wedding region recomputes its guests');
update public.weddings set phone_region = null where id = '20000000-0000-0000-0000-000000000002';
select is((select phone_e164 from public.guests where first_name = 'Sanne'), null,
  'clearing the region stops national numbers matching');
update public.weddings set phone_region = 'NL' where id = '20000000-0000-0000-0000-000000000002';

-- ---------- contact-first join ----------
select is(public.find_guest_by_contact('phone-nl', '06 12 34 56 78') ->> 'token',
  '40000000-0000-0000-0000-000000000003',
  'a Dutch guest typing their national number finds themselves in a Dutch wedding');
select is(public.find_guest_by_contact('phone-us', '(415) 555 2671') ->> 'token',
  '40000000-0000-0000-0000-000000000004',
  'a US guest typing their national number finds themselves in a US wedding');
select is(public.find_guest_by_contact('phone-fr', '415-555-2671') ->> 'status', 'not_found',
  'a US number without + is not found in a French wedding');
select is(public.find_guest_by_contact('phone-fr', '+31 6 12 34 56 78') ->> 'token',
  '40000000-0000-0000-0000-000000000002',
  'a Dutch guest typing +31 reaches their own row, not the French guest with the same digits');

-- ---------- verified Auth phone ----------
-- GoTrue stores the confirmed number without its "+".
insert into auth.users (id, email, phone, phone_confirmed_at)
values ('10000000-0000-0000-0000-000000000002', 'dutch-guest@example.test',
        '31612345678', now());
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select is(
  (select jsonb_array_length(public.get_guest_access_options('phone-fr') -> 'matches')),
  1,
  'a verified +31 phone finds exactly the Dutch guest in a French wedding');
select is(public.claim_guest_access('30000000-0000-0000-0000-000000000002') ->> 'status', 'verified',
  'a verified +31 phone can claim the guest stored with +31');

select * from finish();
rollback;
