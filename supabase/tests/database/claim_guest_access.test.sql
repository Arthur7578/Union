begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- Accounts. Contact details only count once Auth has confirmed them, so each
-- kind of contact comes in a confirmed and an unconfirmed flavour.
--   1 owner of the wedding
--   2 alice  confirmed email
--   3 bob    UNconfirmed email
--   4 carol  confirmed email
--   5 dana   confirmed phone, no email
--   6 erin   UNconfirmed phone, no email
-- Auth keeps a phone without its leading "+".
insert into auth.users (id, email, email_confirmed_at, phone, phone_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'claim-owner@example.test', now(), null, null),
  ('10000000-0000-0000-0000-000000000002', 'alice@example.test', now(), null, null),
  ('10000000-0000-0000-0000-000000000003', 'bob@example.test', null, null, null),
  ('10000000-0000-0000-0000-000000000004', 'carol@example.test', now(), null, null),
  ('10000000-0000-0000-0000-000000000005', null, null, '33612345678', now()),
  ('10000000-0000-0000-0000-000000000006', null, null, '33687654321', null);

insert into public.weddings (id, owner_id, partner_one, partner_two)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alex', 'Sam');

-- Guest N has token N.
--   1 alice's row, stored with different case and a trailing space
--   2 bob's row
--   3 a stranger's row
--   4 a row with no email at all
--   5 already linked to carol, whose own email does not match it
--   6 linked to carol; alice has no claim on it
--   7 carol's address, but still linked to alice's older account
--   8 reachable by dana's phone: it states its country, typed with spaces
--   9 reachable by erin's phone, likewise
insert into public.guests (id, wedding_id, invite_token, first_name, email, phone, profile_id)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Alice', 'Alice@Example.test ', null, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Bob', 'bob@example.test', null, null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Stranger', 'someone-else@example.test', null, null),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'No email', null, null, null),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 'Linked', 'frank@example.test', null, '10000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 'Taken', 'grace@example.test', null, '10000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 'Relinked', 'carol@example.test', null, '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000008', 'Dana', null, '+33 6 12 34 56 78', null),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000009', 'Erin', null, '+33 6 87 65 43 21', null);

-- No session at all.
set local request.jwt.claims = '';
set local request.jwt.claim.sub = '';

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000001') ->> 'status',
  'not_authenticated',
  'a call with no signed-in user is refused'
);

-- The anon role has no business here; the function is for signed-in users.
set local role anon;

select throws_ok(
  $$select public.claim_guest_access('30000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'the anon role cannot call it at all'
);

reset role;

-- alice: confirmed email.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000002", "role": "authenticated", "email": "alice@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local role authenticated;

select is(
  public.claim_guest_access('30000000-0000-0000-0000-0000000000ff') ->> 'status',
  'not_found',
  'a guest that does not exist is reported as not found'
);

select results_eq(
  $$select r ->> 'status', r ->> 'token', r ->> 'first_name'
      from (select public.claim_guest_access('30000000-0000-0000-0000-000000000001') as r) as s$$,
  $$values ('verified', '40000000-0000-0000-0000-000000000001', 'Alice')$$,
  'a confirmed email matching the guest, ignoring case and spaces, returns the invitation token'
);

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000003') ->> 'status',
  'not_available',
  'an email that is not the guest''s is refused'
);

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000004') ->> 'status',
  'not_available',
  'a guest with no email on file cannot be claimed by email'
);

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000006') ->> 'status',
  'not_available',
  'a guest already linked to someone else cannot be taken without a contact match'
);

reset role;

select is(
  (select profile_id from public.guests where id = '30000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'a successful claim links the guest to the account'
);

select is(
  (select profile_id from public.guests where id = '30000000-0000-0000-0000-000000000006'),
  '10000000-0000-0000-0000-000000000004'::uuid,
  'a refused claim leaves the existing link in place'
);

-- bob: the address matches the guest's, but Auth never confirmed it.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated", "email": "bob@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local role authenticated;

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000002') ->> 'status',
  'not_available',
  'an email address that is not confirmed does not count, even when it matches'
);

reset role;

-- carol: confirmed email, and a guest already linked to her.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000004", "role": "authenticated", "email": "carol@example.test"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
set local role authenticated;

select results_eq(
  $$select r ->> 'status', r ->> 'token'
      from (select public.claim_guest_access('30000000-0000-0000-0000-000000000005') as r) as s$$,
  $$values ('verified', '40000000-0000-0000-0000-000000000005')$$,
  'the account a guest is linked to keeps access without needing a contact match'
);

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000007') ->> 'status',
  'verified',
  'a confirmed email matching the guest wins over an older link'
);

reset role;

select is(
  (select profile_id from public.guests where id = '30000000-0000-0000-0000-000000000007'),
  '10000000-0000-0000-0000-000000000004'::uuid,
  'the verified account replaces the older one on the guest'
);

-- dana: confirmed phone, matched against the guest's number after normalising.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000005", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
set local role authenticated;

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000008') ->> 'status',
  'verified',
  'a confirmed phone matches a guest number that states its country, however it was spaced'
);

-- A guest with no phone has no canonical number, so comparing it with the
-- caller's phone gives null, not false. That used to skip the refusal and
-- hand the guest to anyone with a confirmed phone.
select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000004') ->> 'status',
  'not_available',
  'a confirmed phone cannot claim a guest who has no phone on file'
);

reset role;

-- erin: the number matches, but Auth never confirmed it.
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000006", "role": "authenticated"}';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000006';
set local role authenticated;

select is(
  public.claim_guest_access('30000000-0000-0000-0000-000000000009') ->> 'status',
  'not_available',
  'a phone number that is not confirmed does not count, even when it matches'
);

reset role;

select is(
  (select count(*)
     from public.guests
    where id in (
      '30000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000004',
      '30000000-0000-0000-0000-000000000009'
    )
      and profile_id is not null),
  0::bigint,
  'no refused claim linked an account to a guest'
);

select * from finish();
rollback;
