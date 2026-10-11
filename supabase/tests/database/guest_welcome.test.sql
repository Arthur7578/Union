begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- One wedding per disclosure tier, a join code each, and one guest on the
-- 'full' wedding. Every address field is filled in so anything a tier should
-- withhold is sitting in the row waiting to leak.
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'welcome-owner@example.test');

insert into public.weddings (
  id, owner_id, partner_one, partner_two, venue_name, venue_address,
  address_line, address_postal_code, address_city, address_area,
  address_country, address_visibility, join_code
)
select
  w.id::uuid, '10000000-0000-0000-0000-000000000001', 'Alex', 'Sam',
  'Sentinel Venue', 'Sentinel Legacy Address', '12 Sentinel Street',
  'SENT-9999', 'Sentinelville', 'Sentinel Coast', 'Sentinelland',
  w.tier::public.address_visibility, 'welcome-' || w.tier
from (values
  ('20000000-0000-0000-0000-000000000001', 'hidden'),
  ('20000000-0000-0000-0000-000000000002', 'area'),
  ('20000000-0000-0000-0000-000000000003', 'partial'),
  ('20000000-0000-0000-0000-000000000004', 'full')
) as w(id, tier);

insert into public.guests (id, wedding_id, invite_token, first_name)
values (
  '30000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000004',
  '40000000-0000-0000-0000-000000000004',
  'Full guest'
);

-- The group link discloses exactly what a guest's own link does.
select is(
  public.get_wedding_by_join_code('welcome-hidden') #>> '{address}',
  null,
  'hidden: the join link carries no address'
);
select is(
  public.get_wedding_by_join_code('welcome-hidden') #>> '{venue_name}',
  null,
  'hidden: the join link withholds the venue name'
);
select is(
  public.get_wedding_by_join_code('welcome-area') #>> '{address,area}',
  'Sentinel Coast',
  'area: the join link carries the area'
);
select is(
  public.get_wedding_by_join_code('welcome-area') #>> '{address,city}',
  null,
  'area: the join link withholds the city'
);
select is(
  public.get_wedding_by_join_code('welcome-partial') #>> '{address,line}',
  null,
  'partial: the join link withholds the street'
);
select is(
  public.get_wedding_by_join_code('welcome-full') #>> '{venue_name}',
  'Sentinel Venue',
  'full: the join link carries the venue name'
);

-- Seen once, remembered on the guest.
select is(
  public.get_invitation('40000000-0000-0000-0000-000000000004') #>> '{guest,welcome_seen_at}',
  null,
  'a new guest has not seen the welcome'
);
select public.mark_welcome_seen('40000000-0000-0000-0000-000000000004');
select isnt(
  public.get_invitation('40000000-0000-0000-0000-000000000004') #>> '{guest,welcome_seen_at}',
  null,
  'marking it seen is reported on the invitation'
);

select * from finish();
rollback;
