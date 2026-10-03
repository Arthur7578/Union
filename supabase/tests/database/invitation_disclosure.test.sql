begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

-- One wedding per disclosure tier. Every address field is filled in on every
-- wedding (the check constraint allows that for all four tiers), so anything
-- a tier is meant to withhold is sitting in the row waiting to leak. The
-- values are distinctive strings that cannot occur in a UUID or a name.
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'disclosure-owner@example.test');

insert into public.weddings (
  id,
  owner_id,
  partner_one,
  partner_two,
  venue_name,
  venue_address,
  address_line,
  address_postal_code,
  address_city,
  address_area,
  address_country,
  address_visibility
)
select
  w.id::uuid,
  '10000000-0000-0000-0000-000000000001',
  'Alex',
  'Sam',
  'Sentinel Venue',
  'Sentinel Legacy Address',
  '12 Sentinel Street',
  'SENT-9999',
  'Sentinelville',
  'Sentinel Coast',
  'Sentinelland',
  w.tier::public.address_visibility
from (values
  ('20000000-0000-0000-0000-000000000001', 'hidden'),
  ('20000000-0000-0000-0000-000000000002', 'area'),
  ('20000000-0000-0000-0000-000000000003', 'partial'),
  ('20000000-0000-0000-0000-000000000004', 'full')
) as w(id, tier);

-- Wedding N has guest N, whose token ends in the same digit.
insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Hidden guest'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Area guest'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Partial guest'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 'Full guest');

-- hidden: nothing about where the wedding is.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000001') #>> '{wedding,address}',
  null,
  'hidden: the invitation carries no address'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000001') #>> '{wedding,venue_name}',
  null,
  'hidden: the venue name is withheld'
);

select is(
  (select count(*)
     from unnest(array[
       'Sentinel Venue', 'Sentinel Legacy Address', '12 Sentinel Street',
       'SENT-9999', 'Sentinelville', 'Sentinel Coast', 'Sentinelland'
     ]) as withheld
    where public.get_invitation('40000000-0000-0000-0000-000000000001')::text like '%' || withheld || '%'),
  0::bigint,
  'hidden: no address or venue field appears anywhere in the payload'
);

-- area: only the broad area and the country.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000002') #> '{wedding,address}',
  '{"line": null, "postal_code": null, "city": null, "area": "Sentinel Coast", "country": "Sentinelland"}'::jsonb,
  'area: the invitation carries the area and country and nothing finer'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000002') #>> '{wedding,venue_name}',
  null,
  'area: the venue name is withheld'
);

select is(
  (select count(*)
     from unnest(array[
       'Sentinel Venue', 'Sentinel Legacy Address', '12 Sentinel Street',
       'SENT-9999', 'Sentinelville'
     ]) as withheld
    where public.get_invitation('40000000-0000-0000-0000-000000000002')::text like '%' || withheld || '%'),
  0::bigint,
  'area: no street, postal code, city or venue appears anywhere in the payload'
);

-- partial: postal code and city, but not the street and not the area.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000003') #> '{wedding,address}',
  '{"line": null, "postal_code": "SENT-9999", "city": "Sentinelville", "area": null, "country": "Sentinelland"}'::jsonb,
  'partial: the invitation carries postal code, city and country but no street or area'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000003') #>> '{wedding,venue_name}',
  null,
  'partial: the venue name is withheld'
);

select is(
  (select count(*)
     from unnest(array[
       'Sentinel Venue', 'Sentinel Legacy Address', '12 Sentinel Street', 'Sentinel Coast'
     ]) as withheld
    where public.get_invitation('40000000-0000-0000-0000-000000000003')::text like '%' || withheld || '%'),
  0::bigint,
  'partial: no street, area or venue appears anywhere in the payload'
);

-- full: the precise address, and the only tier that names the venue.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000004') #> '{wedding,address}',
  '{"line": "12 Sentinel Street", "postal_code": "SENT-9999", "city": "Sentinelville", "area": null, "country": "Sentinelland"}'::jsonb,
  'full: the invitation carries the street, postal code, city and country'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000004') #>> '{wedding,venue_name}',
  'Sentinel Venue',
  'full: the venue name is disclosed'
);

-- The rest of the contract of the same function.
select throws_ok(
  $$select public.get_invitation('40000000-0000-0000-0000-0000000000ff')$$,
  'P0001',
  'Invalid invitation token',
  'an unknown token is refused'
);

-- Guests are not signed in: the invitation has to work for the anon role,
-- and has to read rows that role cannot select directly.
set local role anon;

-- lives_ok covers both halves: the function raises when it cannot find the
-- guest, so it only passes if the call is allowed and the guest row is read.
select lives_ok(
  $$select public.get_invitation('40000000-0000-0000-0000-000000000004')$$,
  'a signed-out guest can open their invitation'
);

reset role;

-- guest_modules: an absent key means "on", so an untouched wedding reports
-- an empty map and a configured one reports exactly what the couple turned off.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000001') #> '{wedding,guest_modules}',
  '{}'::jsonb,
  'a wedding that never configured modules reports an empty map'
);

update public.weddings
   set guest_modules = '{"travel": false, "logistics": false}'
 where id = '20000000-0000-0000-0000-000000000001';

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000001') #> '{wedding,guest_modules}',
  '{"travel": false, "logistics": false}'::jsonb,
  'the invitation reports the modules the couple turned off'
);

select * from finish();
rollback;
