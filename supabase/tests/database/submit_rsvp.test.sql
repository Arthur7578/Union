begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'rsvp-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alex', 'Sam');

-- Guest 1 replies; guest 2 shares the wedding and must be left alone.
insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Replying guest'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Bystander');

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000001') #>> '{guest,rsvp_status}',
  'pending',
  'a guest who has not replied is reported as pending'
);

select lives_ok(
  $$select public.submit_rsvp(
      '40000000-0000-0000-0000-000000000001',
      'attending',
      'Vegetarian',
      'Looking forward to it'
    )$$,
  'a guest can reply that they are attending'
);

select results_eq(
  $$select status::text, dietary_notes, message, responded_at is not null
      from public.rsvps
     where guest_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values ('attending', 'Vegetarian', 'Looking forward to it', true)$$,
  'the reply is stored with its notes, message and a response time'
);

select results_eq(
  $$select g ->> 'rsvp_status', g ->> 'dietary_notes', g ->> 'message'
      from (select public.get_invitation('40000000-0000-0000-0000-000000000001') -> 'guest' as g) as s$$,
  $$values ('attending', 'Vegetarian', 'Looking forward to it')$$,
  'the invitation reads the stored reply back'
);

select is(
  (select count(*) from public.rsvps where guest_id = '30000000-0000-0000-0000-000000000002'),
  0::bigint,
  'replying does not create a reply for anyone else at the wedding'
);

select lives_ok(
  $$select public.submit_rsvp(
      '40000000-0000-0000-0000-000000000001',
      'declined',
      'Nothing needed',
      'Sorry, we cannot make it'
    )$$,
  'a guest can change their reply'
);

select results_eq(
  $$select status::text, dietary_notes, message
      from public.rsvps
     where guest_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values ('declined', 'Nothing needed', 'Sorry, we cannot make it')$$,
  'changing a reply replaces the earlier one rather than adding a second row'
);

-- Only attending and declined are answers. The message text is deliberately
-- not pinned: the SQLSTATE is the contract, and the wording may change when
-- the set of accepted answers does.
select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000001', 'pending')$$,
  'P0001',
  null,
  'pending is not an answer a guest can give'
);

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000001', 'banana')$$,
  'P0001',
  null,
  'an unrecognised status is refused'
);

-- Any error will do here: today the table's not-null constraint stops it,
-- and a friendlier explicit check would be just as good.
select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000001', null)$$,
  null::char(5),
  null,
  'a missing status is refused'
);

select results_eq(
  $$select status::text from public.rsvps where guest_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values ('declined')$$,
  'refused replies leave the stored reply untouched'
);

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-0000000000ff', 'attending')$$,
  'P0001',
  'Invalid invitation token',
  'an unknown token cannot record a reply'
);

-- Guests are not signed in, so the reply path has to work for the anon role.
set local role anon;

select lives_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000002', 'attending')$$,
  'a signed-out guest can reply'
);

reset role;

select * from finish();
rollback;
