-- Full disclosure includes the venue identity, so it is not a valid tier
-- until the organiser has supplied the venue name as well as the precise
-- address fields. Existing incomplete rows become private rather than
-- failing the new constraint.
update public.weddings
set address_visibility = 'hidden'
where address_visibility = 'full'
  and nullif(btrim(venue_name), '') is null;

alter table public.weddings
  drop constraint if exists weddings_address_visibility_required_fields_check;

alter table public.weddings
  add constraint weddings_address_visibility_required_fields_check
  check (
    address_visibility = 'hidden'
    or (
      address_visibility = 'area'
      and nullif(btrim(address_area), '') is not null
      and nullif(btrim(address_country), '') is not null
    )
    or (
      address_visibility = 'partial'
      and nullif(btrim(address_postal_code), '') is not null
      and nullif(btrim(address_city), '') is not null
    )
    or (
      address_visibility = 'full'
      and nullif(btrim(venue_name), '') is not null
      and nullif(btrim(address_line), '') is not null
      and nullif(btrim(address_postal_code), '') is not null
      and nullif(btrim(address_city), '') is not null
    )
  );
