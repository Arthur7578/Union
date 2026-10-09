begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(50);

-- Accounts:
--   1 owner of the wedding
--   2 paul    confirmed email, the real Paul
--   3 prank   confirmed email, another guest playing around
--   4 marie   confirmed email, matches the email the couple entered for Marie
--   5 unconf  UNconfirmed email
insert into auth.users (id, email, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'join-owner@example.test', now()),
  ('10000000-0000-0000-0000-000000000002', 'paul@example.test', now()),
  ('10000000-0000-0000-0000-000000000003', 'prank@example.test', now()),
  ('10000000-0000-0000-0000-000000000004', 'marie@example.test', now()),
  ('10000000-0000-0000-0000-000000000005', 'unconf@example.test', null);

insert into public.weddings (id, owner_id, partner_one, partner_two, join_code)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Alex', 'Sam', 'join-secure');

-- Guest N has token N.
--   1 Paul       no last name, no email: unique first name
--   2 Zaza Martin
--   3 Zaza Durand  (two Zazas: the last name decides)
--   4 Léa-Rose   accents and a hyphen, typed loosely by the guest
--   5 Marie      the couple entered her email
--   6 Tom Petit, 7 Tom Petit: same full name, only the couple can tell
--   8 Julie      no email, for the light-mode and reply checks
insert into public.guests (id, wedding_id, invite_token, first_name, last_name, email)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Paul', null, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Zaza', 'Martin', null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Zaza', 'Durand', null),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'Léa-Rose', null, null),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 'Marie', null, 'Marie@Example.test '),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 'Tom', 'Petit', null),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 'Tom', 'Petit', null),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000008', 'Julie', null, null);

-- ---------- modes ----------
select is((select guest_join_auth_mode from public.weddings where join_code = 'join-secure'), 'secure',
  'a new wedding uses secure mode');
select throws_ok(
  $$update public.weddings set guest_join_auth_mode = 'contact' where join_code = 'join-secure'$$,
  '23514', null, 'contact matching is no longer a mode');
select is(public.get_wedding_by_join_code('join-secure') ->> 'guest_join_auth_mode', 'secure',
  'the group link page is told the mode');
select hasnt_function('public', 'find_guest_by_contact', 'contact matching is gone');
select hasnt_function('public', 'complete_guest_email_setup', 'the forced email screen is gone');

-- ---------- provenance of emails ----------
select is((select email_source from public.guests where first_name = 'Marie'), 'organiser',
  'an email the couple enters is marked as theirs');
select is((select email_confirmed_at from public.guests where first_name = 'Marie'), null,
  'and is not confirmed');
select is((select email_source from public.guests where first_name = 'Paul'), null,
  'no email, no source');

-- ---------- find_guest_for_join (anonymous) ----------
set local role anon;

select is(public.find_guest_for_join('join-secure', 'paul') ->> 'guest_id',
  '30000000-0000-0000-0000-000000000001', 'a unique first name finds the guest, ignoring case');
select is(public.find_guest_for_join('join-secure', 'Paul') ->> 'token', null,
  'secure mode never hands out the invitation link for a name');
select is(public.find_guest_for_join('join-secure', '  lea rose ') ->> 'guest_id',
  '30000000-0000-0000-0000-000000000004', 'accents, spaces and hyphens are ignored');
select is(public.find_guest_for_join('join-secure', 'Paula') ->> 'status', 'not_found',
  'names are not matched fuzzily');
select is(public.find_guest_for_join('join-secure', 'Marie') ->> 'status', 'match',
  'a guest whose email the couple entered is found by name');
select is(public.find_guest_for_join('join-secure', 'Zaza') ->> 'status', 'needs_last_name',
  'two guests with the same first name: the last name is asked');
select is(public.find_guest_for_join('join-secure', 'Zaza', 'durand') ->> 'guest_id',
  '30000000-0000-0000-0000-000000000003', 'the last name picks the right one');
select is(public.find_guest_for_join('join-secure', 'Zaza', 'Dupont') ->> 'status', 'not_found',
  'a last name neither has is not found');
select is(public.find_guest_for_join('join-secure', 'Paul', 'Anything') ->> 'guest_id',
  '30000000-0000-0000-0000-000000000001', 'a last name is ignored when the first name is unique');
select is(public.find_guest_for_join('join-secure', 'Tom', 'Petit') ->> 'status', 'ambiguous',
  'the same full name twice cannot be told apart');
select is(public.find_guest_for_join('nope', 'Paul') ->> 'status', 'invalid_link',
  'an unknown link is reported');
select is(public.find_guest_for_join('join-secure', '') ->> 'status', 'not_found',
  'an empty name finds nobody');

-- ---------- check_join_email (anonymous, before a code is sent) ----------
select is(public.check_join_email('join-secure', '30000000-0000-0000-0000-000000000005', 'marie@example.test') ->> 'status', 'ok',
  'the email the couple entered is accepted, ignoring case');
select is(public.check_join_email('join-secure', '30000000-0000-0000-0000-000000000005', 'other@example.test') ->> 'status', 'email_mismatch',
  'another email is refused when the couple entered one');
select is(public.check_join_email('join-secure', '30000000-0000-0000-0000-000000000001', 'paul@example.test') ->> 'status', 'ok',
  'any email can secure an invitation that has none');
select is(public.check_join_email('join-secure', '30000000-0000-0000-0000-000000000001', 'not an email') ->> 'status', 'invalid_email',
  'something that is not an email is refused');
reset role;

-- ---------- secure_guest_invitation ----------
set local role authenticated;

set local request.jwt.claim.sub = '';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000001') ->> 'status', 'not_authenticated',
  'nobody signed in, nothing secured');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000001') ->> 'status', 'email_not_confirmed',
  'an unconfirmed email secures nothing');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000001') ->> 'token',
  '40000000-0000-0000-0000-000000000001', 'the first confirmed email secures an invitation with none and opens it');
reset role;
select is((select email || '|' || email_source || '|' || (email_confirmed_at is not null)::text
           from public.guests where first_name = 'Paul'),
  'paul@example.test|guest|true', 'that email is now the guest''s, given by them and confirmed');
set local role authenticated;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000001') ->> 'status', 'already_secured',
  'someone else cannot take a secured invitation');
reset role;
set local role anon;
select is(public.check_join_email('join-secure', '30000000-0000-0000-0000-000000000001', 'prank@example.test') ->> 'status', 'already_secured',
  'and is told so before any code is sent');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000005') ->> 'status', 'email_mismatch',
  'a confirmed email that is not the one the couple entered does not open it');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000005') ->> 'status', 'verified',
  'the owner of the email the couple entered opens it');
reset role;
select is((select email_source || '|' || (email_confirmed_at is not null)::text || '|' || (profile_id is not null)::text
           from public.guests where first_name = 'Marie'),
  'organiser|true|true', 'and it is now confirmed, still marked as entered by the couple');
set local role authenticated;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000001') ->> 'status', 'verified',
  'the account that secured an invitation gets back in, on any device');
select is(public.secure_guest_invitation('join-secure', '30000000-0000-0000-0000-000000000006') ->> 'status', 'verified',
  'one email can secure several invitations (a household sharing an address)');
reset role;

-- ---------- the couple edits an email ----------
update public.guests set email = 'PAUL@example.test' where first_name = 'Paul';
select is((select email_source || '|' || (email_confirmed_at is not null)::text from public.guests where first_name = 'Paul'),
  'guest|true', 'a change of case is not a new email');
update public.guests set email = 'paul.new@example.test' where first_name = 'Paul';
select is((select email_source || '|' || (email_confirmed_at is not null)::text from public.guests where first_name = 'Paul'),
  'organiser|false', 'a new address entered by the couple is theirs and unconfirmed');

-- ---------- reset_guest_access ----------
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is(public.reset_guest_access('30000000-0000-0000-0000-000000000006') ->> 'status', 'not_found',
  'only the couple can reset access');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select is(public.reset_guest_access('30000000-0000-0000-0000-000000000006') ->> 'status', 'ok',
  'the couple can');
reset role;
select is((select coalesce(email, '-') || '|' || (profile_id is null)::text from public.guests
           where id = '30000000-0000-0000-0000-000000000006'),
  '-|true', 'a reset removes the account link and the email the guest gave');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select is(public.reset_guest_access('30000000-0000-0000-0000-000000000005') ->> 'status', 'ok',
  'resetting a guest whose email the couple entered');
reset role;
select is((select email from public.guests where first_name = 'Marie'), 'Marie@Example.test ',
  'keeps the email the couple entered');

-- ---------- light mode ----------
update public.weddings set guest_join_auth_mode = 'light' where join_code = 'join-secure';
set local role anon;
select is(public.find_guest_for_join('join-secure', 'julie') ->> 'token',
  '40000000-0000-0000-0000-000000000008', 'light mode opens the invitation from the name alone');
select is(public.find_guest_for_join('join-secure', 'Zaza') ->> 'status', 'needs_last_name',
  'and still asks the last name when two guests share the first name');

-- ---------- set_guest_email (a guest adds an email when replying) ----------
select is(public.set_guest_email('40000000-0000-0000-0000-000000000008', 'Julie@Example.test') ->> 'status', 'ok',
  'a guest without an email can add one');
select is(public.set_guest_email('40000000-0000-0000-0000-000000000008', 'someone@example.test') ->> 'status', 'email_already_set',
  'but cannot replace one already on file');
reset role;
select is((select email || '|' || email_source || '|' || (email_confirmed_at is null)::text from public.guests where first_name = 'Julie'),
  'julie@example.test|guest|true', 'it is saved as given by the guest, not confirmed');

-- ---------- rate limit ----------
set local role anon;
set local request.headers = '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}';
select is(
  (select count(*)::int from generate_series(1, 30) s
   where public.find_guest_for_join('join-secure', 'Nobody' || s) ->> 'status' = 'not_found'),
  30, 'thirty searches in ten minutes are answered');
select is(public.find_guest_for_join('join-secure', 'Julie') ->> 'status', 'rate_limited',
  'the next one from the same address is refused');
set local request.headers = '{"x-forwarded-for": "198.51.100.2"}';
select is(public.find_guest_for_join('join-secure', 'Julie') ->> 'status', 'match',
  'another address is not affected');
reset role;

select * from finish();
rollback;
