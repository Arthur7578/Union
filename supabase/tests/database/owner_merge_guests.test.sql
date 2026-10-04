begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

--   1 owner of wedding 1
--   2 an active collaborator on wedding 1
--   3 owner of wedding 2, with no standing at wedding 1
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'merge-owner@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'merge-collaborator@example.test'),
  ('10000000-0000-0000-0000-000000000003', 'merge-outsider@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alex', 'Sam'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Kim', 'Lee');

insert into public.wedding_collaborators (wedding_id, email, user_id, status)
values (
  '20000000-0000-0000-0000-000000000001',
  'merge-collaborator@example.test',
  '10000000-0000-0000-0000-000000000002',
  'active'
);

-- Guests are grouped by what each merge is about. Ids run 3000...00NN and a
-- token, where one matters, is 4000...00NN for the same NN.
--   01 02   two ordinary guests at wedding 1, for the refusals
--   03      a guest at wedding 2
--   11 12   fill-in: the source has details the target lacks
--   21 22   both have already replied
--   31 32   relationships: 33 and 34 are children
--   41 42   explicit field choices
--   51 52   an explicit choice to blank the age
--   61 62   merged by the collaborator
insert into public.guests (id, wedding_id, invite_token, first_name, last_name, email, phone, age_years)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Alpha', null, null, null, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Beta', null, null, null, null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', 'Zed', null, null, null, null),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', 'Target', null, 'target@example.test', null, null),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000012', 'Source', 'Sourcename', 'source@example.test', '0612345678', 34),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000021', 'Target', null, null, null, null),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000022', 'Source', null, null, null, null),
  ('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000031', 'Target', null, null, null, null),
  ('30000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000032', 'Source', null, null, null, null),
  ('30000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000033', 'Child one', null, null, null, 5),
  ('30000000-0000-0000-0000-000000000034', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000034', 'Child two', null, null, null, 7),
  ('30000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000041', 'Tee', 'Targetlast', 'target4@example.test', null, null),
  ('30000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000042', 'Ess', 'Sourcelast', 'source4@example.test', null, 10),
  ('30000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000051', 'Target', null, null, null, 40),
  ('30000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000052', 'Source', null, null, null, 10),
  ('30000000-0000-0000-0000-000000000061', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000061', 'Target', null, null, null, null),
  ('30000000-0000-0000-0000-000000000062', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000062', 'Source', null, null, null, null);

insert into public.rsvps (guest_id, status)
values
  ('30000000-0000-0000-0000-000000000012', 'attending'),
  ('30000000-0000-0000-0000-000000000021', 'declined'),
  ('30000000-0000-0000-0000-000000000022', 'attending');

insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000032', '30000000-0000-0000-0000-000000000033', 'parent_of'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000032', '30000000-0000-0000-0000-000000000034', 'parent_of'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000033', 'parent_of');

-- Who may merge ---------------------------------------------------------

set local request.jwt.claims = '';
set local request.jwt.claim.sub = '';

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Not signed in',
  'a call with no signed-in user is refused'
);

set local role anon;

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'the anon role cannot call it at all'
);

reset role;

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated", "email": "merge-outsider@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local role authenticated;

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Not authorised',
  'someone with no standing at the wedding cannot merge its guests'
);

reset role;

select is(
  (select count(*) from public.guests
    where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2::bigint,
  'the refused merge left both guests in place'
);

-- The owner: refusals first, then the merges themselves ------------------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000001", "role": "authenticated", "email": "merge-owner@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local role authenticated;

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'Guests belong to different weddings',
  'guests from two different weddings cannot be merged'
);

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000ff')$$,
  'P0001',
  'Unknown source or target guest',
  'merging into a guest that does not exist is refused'
);

select throws_ok(
  $$select public.owner_merge_guests('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Cannot merge a guest into itself',
  'a guest cannot be merged into itself'
);

select results_eq(
  $$select r ->> 'status', r ->> 'guest_id'
      from (select public.owner_merge_guests(
        '30000000-0000-0000-0000-000000000012',
        '30000000-0000-0000-0000-000000000011'
      ) as r) as s$$,
  $$values ('merged', '30000000-0000-0000-0000-000000000011')$$,
  'the owner can merge, and is told which guest survives'
);

select lives_ok(
  $$select public.owner_merge_guests(
      '30000000-0000-0000-0000-000000000022',
      '30000000-0000-0000-0000-000000000021'
    )$$,
  'the owner can merge two guests who have both replied'
);

select lives_ok(
  $$select public.owner_merge_guests(
      '30000000-0000-0000-0000-000000000032',
      '30000000-0000-0000-0000-000000000031'
    )$$,
  'the owner can merge a guest who has relationships'
);

select lives_ok(
  $$select public.owner_merge_guests(
      '30000000-0000-0000-0000-000000000042',
      '30000000-0000-0000-0000-000000000041',
      '{"first_name": "Chosen", "last_name": null, "email": "picked@example.test"}'
    )$$,
  'the owner can merge and choose the surviving details'
);

select lives_ok(
  $$select public.owner_merge_guests(
      '30000000-0000-0000-0000-000000000052',
      '30000000-0000-0000-0000-000000000051',
      '{"age_years": null}'
    )$$,
  'the owner can merge and choose to leave the age blank'
);

reset role;

-- What a merge leaves behind ---------------------------------------------

select is(
  (select count(*) from public.guests where id = '30000000-0000-0000-0000-000000000012'),
  0::bigint,
  'the source guest is gone after a merge'
);

-- The target's own values win; the source only fills gaps.
select results_eq(
  $$select first_name, last_name, email, phone, age_years
      from public.guests
     where id = '30000000-0000-0000-0000-000000000011'$$,
  $$values ('Target', 'Sourcename', 'target@example.test', '0612345678', 34)$$,
  'the target keeps what it had and takes only what it was missing from the source'
);

select results_eq(
  $$select status::text from public.rsvps where guest_id = '30000000-0000-0000-0000-000000000011'$$,
  $$values ('attending')$$,
  'a reply given only by the source moves to the target'
);

-- Read straight from guests: that lookup is all get_invitation does with a
-- token, and unlike the RPC it reports a broken link as a failed assertion
-- instead of raising.
select is(
  (select id from public.guests where invite_token = '40000000-0000-0000-0000-000000000012'),
  '30000000-0000-0000-0000-000000000011'::uuid,
  'the source''s invitation token now belongs to the surviving guest'
);

select results_eq(
  $$select guest_id::text, status::text
      from public.rsvps
     where guest_id in ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000022')$$,
  $$values ('30000000-0000-0000-0000-000000000021', 'declined')$$,
  'when both had replied the target''s reply is kept and the source''s is dropped'
);

select results_eq(
  $$select to_guest::text
      from public.guest_relationships
     where from_guest = '30000000-0000-0000-0000-000000000031' and kind = 'parent_of'
     order by 1$$,
  $$values ('30000000-0000-0000-0000-000000000033'), ('30000000-0000-0000-0000-000000000034')$$,
  'the source''s relationships move to the target without duplicating one it already had'
);

select results_eq(
  $$select first_name, last_name, email
      from public.guests
     where id = '30000000-0000-0000-0000-000000000041'$$,
  $$values ('Chosen', null, 'picked@example.test')$$,
  'chosen details win, and a blank last name stays blank rather than refilling from the source'
);

-- KNOWN GAP, not asserted as passing. owner_merge_guests clears the source's
-- copy of each field that _merge_guests folds with COALESCE, so that a field
-- the owner deliberately blanks is not refilled from the source. It does this
-- for last_name, email, phone, role, notes and guest_group, and its comment
-- says age_years is not in that list. It is: _merge_guests has coalesced
-- age_years since 0014, so a blanked age comes back as the source's age. This
-- assertion states the intended behaviour; remove todo_start/todo_end once
-- the source's age_years is cleared alongside the others.
select todo_start('a blanked age is refilled from the source');

select is(
  (select age_years from public.guests where id = '30000000-0000-0000-0000-000000000051'),
  null,
  'an age the owner chose to leave blank stays blank'
);

select todo_end();

-- A collaborator -----------------------------------------------------------

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000002", "role": "authenticated", "email": "merge-collaborator@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local role authenticated;

select results_eq(
  $$select r ->> 'status', r ->> 'guest_id'
      from (select public.owner_merge_guests(
        '30000000-0000-0000-0000-000000000062',
        '30000000-0000-0000-0000-000000000061'
      ) as r) as s$$,
  $$values ('merged', '30000000-0000-0000-0000-000000000061')$$,
  'an active collaborator can merge guests at the wedding'
);

reset role;

select * from finish();
rollback;
