begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

-- Guest N has token N.
--   1 no email
--   2 an email the couple entered, with stray case and spaces
--   3 an address with nothing before the "@"
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'hint-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, join_code)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Alex', 'Sam', 'hint-join');

insert into public.guests (id, wedding_id, invite_token, first_name, email)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Julie', null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Marie', ' Marie.Curie@Example.test '),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Paul', '@example.test');

select is(public.get_guest_email_status('40000000-0000-0000-0000-000000000001') ->> 'email_missing', 'true',
  'a guest without an email is reported as missing one');
select is(public.get_guest_email_status('40000000-0000-0000-0000-000000000001') ->> 'email_hint', null,
  'and gets no hint');
select is(public.get_guest_email_status('40000000-0000-0000-0000-000000000002') ->> 'email_hint', 'M•••@Example.test',
  'an email on file is shown with its local part masked');
select is(public.get_guest_email_status('40000000-0000-0000-0000-000000000003') ->> 'email_hint', '•••',
  'an address with nothing before the @ reveals nothing');

-- The guest gives an email when replying: the hint follows.
select is(public.set_guest_email('40000000-0000-0000-0000-000000000001', 'julie@gmail.com') ->> 'status', 'ok',
  'the guest saves an email');
select is(public.get_guest_email_status('40000000-0000-0000-0000-000000000001') ->> 'email_hint', 'j•••@gmail.com',
  'an email the guest gave is hinted the same way');

select ok(
  not has_function_privilege('anon', 'public._email_hint(text)', 'execute'),
  'the masking helper is not callable directly'
);

select * from finish();
rollback;
