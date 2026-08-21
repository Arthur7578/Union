begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'permissions-owner@example.test');

insert into public.weddings (
  id,
  owner_id,
  partner_one,
  partner_two,
  allow_guests_add_partner,
  allow_guests_add_children,
  max_children_per_guest
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Default',
    'Allowed',
    true,
    true,
    1
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Default',
    'Denied',
    false,
    false,
    null
  );

insert into public.guests (
  id,
  wedding_id,
  invite_token,
  first_name,
  can_add_partner,
  can_add_kids
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Inherits defaults',
    null,
    null
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Explicitly denied',
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    'Explicitly allowed',
    true,
    true
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'Child cap',
    false,
    null
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005',
    'One partner',
    null,
    false
  );

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000001') #>> '{permissions,can_add_partner}')::boolean,
  true,
  'an inheriting guest receives the wedding partner default'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000002') #>> '{permissions,can_add_partner}')::boolean,
  false,
  'an explicit partner denial beats an allowed wedding default'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000003') #>> '{permissions,can_add_partner}')::boolean,
  true,
  'an explicit partner grant beats a denied wedding default'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000001') #>> '{permissions,can_add_kids}')::boolean,
  true,
  'an inheriting guest receives the wedding children default'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000002') #>> '{permissions,can_add_kids}')::boolean,
  false,
  'an explicit children denial beats an allowed wedding default'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000004') #>> '{permissions,kids_remaining}')::integer,
  1,
  'the invitation reports the initial children budget'
);

select lives_ok(
  $$select public.rsvp_register_companion(
      '40000000-0000-0000-0000-000000000004',
      'child',
      'First child',
      null,
      'force_create'
    )$$,
  'a guest can register a child while budget remains'
);

select is(
  (public.get_invitation('40000000-0000-0000-0000-000000000004') #>> '{permissions,kids_remaining}')::integer,
  0,
  'the invitation reports an exhausted children budget'
);

select throws_ok(
  $$select public.rsvp_register_companion(
      '40000000-0000-0000-0000-000000000004',
      'child',
      'Second child',
      null,
      'force_create'
    )$$,
  'P0001',
  'Children-per-guest limit reached',
  'the registration RPC enforces the children cap'
);

select lives_ok(
  $$select public.rsvp_register_companion(
      '40000000-0000-0000-0000-000000000005',
      'partner',
      'First partner',
      null,
      'force_create'
    )$$,
  'an allowed guest can register one partner'
);

select throws_ok(
  $$select public.rsvp_register_companion(
      '40000000-0000-0000-0000-000000000005',
      'partner',
      'Second partner',
      null,
      'force_create'
    )$$,
  'P0001',
  'Guest already has a partner',
  'the registration RPC rejects a second partner'
);

select has_index(
  'public',
  'guest_relationships',
  'guest_relationships_one_partner_per_guest',
  'the database enforces one outgoing partner relationship per guest'
);

select * from finish();
rollback;
