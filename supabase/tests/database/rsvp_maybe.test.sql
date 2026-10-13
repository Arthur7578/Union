begin;

-- The optional "maybe" answer: off by default, the couple's decision, and
-- enforced by every path a guest can reply through.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

-- One wedding, one household (a guest with a partner and a child they may
-- answer for) and an unrelated guest of the same wedding.
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000020', 'maybe-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values (
  '20000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000020',
  'Maybe',
  'Owner'
);

insert into public.guests (id, wedding_id, invite_token, first_name)
values
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000020', 'Invited guest'),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000021', 'Their partner'),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000022', 'Their child'),
  -- added_by_guest_id stays null, as for every guest the couple imports.
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000023', 'Unrelated guest');

insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
values
  ('20000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000021', 'partner_of'),
  ('20000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000022', 'parent_of');

insert into public.forms (id, wedding_id, kind, purpose, title, published, rsvp_copy)
values (
  '50000000-0000-0000-0000-000000000020',
  '20000000-0000-0000-0000-000000000020',
  'rsvp', 'primary', 'RSVP', true,
  '{"label_maybe": {"en": "Hoping to"}}'::jsonb
);

-- ---------- the data model ----------

select is(
  enum_range(null::public.rsvp_status)::text,
  '{pending,attending,maybe,declined}',
  'maybe sits between attending and declined'
);

select is(
  (select allow_rsvp_maybe from public.weddings where id = '20000000-0000-0000-0000-000000000020'),
  false,
  'a wedding does not offer maybe until its couple opts in'
);

select ok(
  not has_function_privilege('anon', 'public._rsvp_status_allowed(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public._rsvp_status_allowed(uuid, text)', 'execute'),
  'the answer-set check is internal: guests cannot call it'
);

select is(
  public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', 'attending')
  and public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', 'declined'),
  true,
  'attending and declined are always accepted'
);

select is(
  public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', 'maybe')
  or public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', 'pending')
  or public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', 'banana')
  or public._rsvp_status_allowed('20000000-0000-0000-0000-000000000020', null),
  false,
  'with the option off, only attending and declined are accepted'
);

select is(
  public._rsvp_status_allowed('20000000-0000-0000-0000-0000000000ff', 'maybe'),
  false,
  'an unknown wedding never accepts a maybe'
);

-- ---------- the invitation ----------

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000020') #> '{wedding,allow_rsvp_maybe}',
  'false'::jsonb,
  'the invitation tells the portal maybe is off'
);

-- get_invitation is patched in place by several migrations; these keys come
-- from earlier ones and must survive this one.
select ok(
  (public.get_invitation('40000000-0000-0000-0000-000000000020') -> 'rsvp_form') ? 'fields'
  and (public.get_invitation('40000000-0000-0000-0000-000000000020') -> 'guest') ? 'welcome_seen_at',
  'the invitation still carries what earlier migrations added to it'
);

-- ---------- refused while it is off ----------

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000020', 'maybe')$$,
  'P0001',
  null,
  'a guest cannot reply maybe while the option is off'
);

select throws_ok(
  $$select public.submit_companion_rsvp(
      '40000000-0000-0000-0000-000000000020',
      '30000000-0000-0000-0000-000000000021',
      'maybe'
    )$$,
  'P0001',
  null,
  'nor for a companion'
);

select throws_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000020',
      '50000000-0000-0000-0000-000000000020',
      'maybe'
    )$$,
  'P0001',
  null,
  'nor through the household reply'
);

select throws_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000020',
      '50000000-0000-0000-0000-000000000020',
      'attending',
      '[{"guest_id": "30000000-0000-0000-0000-000000000021", "status": "maybe"}]'::jsonb
    )$$,
  'P0001',
  null,
  'nor for a companion in the household reply'
);

select is(
  (select count(*) from public.rsvps
    where guest_id in (
      '30000000-0000-0000-0000-000000000020',
      '30000000-0000-0000-0000-000000000021'
    )),
  0::bigint,
  'a household reply with one refused answer saves none of it'
);

-- ---------- the couple opts in ----------

update public.weddings set allow_rsvp_maybe = true
where id = '20000000-0000-0000-0000-000000000020';

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000020') #> '{wedding,allow_rsvp_maybe}',
  'true'::jsonb,
  'the invitation tells the portal maybe is on'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000020') #>> '{rsvp_form,label_maybe,en}',
  'Hoping to',
  'the invitation carries the couple''s own wording for it'
);

select lives_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000020', 'maybe', 'Vegetarian')$$,
  'a guest can reply maybe once it is on'
);

select is(
  (select status::text from public.rsvps where guest_id = '30000000-0000-0000-0000-000000000020'),
  'maybe',
  'the reply is stored as a maybe, not rounded to a yes or a no'
);

select is(
  (select count(*) from public.activity_log
    where wedding_id = '20000000-0000-0000-0000-000000000020'
      and action_key = 'rsvp_maybe'
      and action_text = 'RSVP''d maybe'),
  1::bigint,
  'a maybe is logged as its own event for the co-organisers'
);

select lives_ok(
  $$select public.submit_companion_rsvp(
      '40000000-0000-0000-0000-000000000020',
      '30000000-0000-0000-0000-000000000021',
      'maybe'
    )$$,
  'a guest can answer maybe for a companion'
);

select lives_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000020',
      '50000000-0000-0000-0000-000000000020',
      'maybe',
      '[
        {"guest_id": "30000000-0000-0000-0000-000000000021", "status": "maybe"},
        {"guest_id": "30000000-0000-0000-0000-000000000022", "status": "attending"}
      ]'::jsonb
    )$$,
  'the household reply takes a maybe for the guest and a companion'
);

select results_eq(
  $$select guest_id::text, status::text from public.rsvps
     where guest_id in (
       '30000000-0000-0000-0000-000000000020',
       '30000000-0000-0000-0000-000000000021',
       '30000000-0000-0000-0000-000000000022'
     ) order by guest_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000020', 'maybe'),
    ('30000000-0000-0000-0000-000000000021', 'maybe'),
    ('30000000-0000-0000-0000-000000000022', 'attending')$$,
  'each person in the household keeps the answer they gave'
);

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000020', 'banana')$$,
  'P0001',
  null,
  'an unrecognised status is still refused with the option on'
);

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000020', 'pending')$$,
  'P0001',
  null,
  'pending is still not an answer with the option on'
);

select throws_ok(
  $$select public.submit_companion_rsvp(
      '40000000-0000-0000-0000-000000000020',
      '30000000-0000-0000-0000-000000000023',
      'maybe'
    )$$,
  'P0001',
  'Not authorised to answer for this guest',
  'a maybe cannot be recorded for an unrelated guest of the same wedding'
);

-- Guests are not signed in, so every reply path has to work for anon.
set local role anon;

select lives_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000023', 'maybe')$$,
  'a signed-out guest can reply maybe'
);

reset role;

-- ---------- the couple turns it off again ----------

update public.weddings set allow_rsvp_maybe = false
where id = '20000000-0000-0000-0000-000000000020';

select results_eq(
  $$select guest_id::text, status::text from public.rsvps
     where guest_id in (
       '30000000-0000-0000-0000-000000000020',
       '30000000-0000-0000-0000-000000000021',
       '30000000-0000-0000-0000-000000000023'
     ) order by guest_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000020', 'maybe'),
    ('30000000-0000-0000-0000-000000000021', 'maybe'),
    ('30000000-0000-0000-0000-000000000023', 'maybe')$$,
  'turning it off never rewrites a maybe already given'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000020') #>> '{guest,rsvp_status}',
  'maybe',
  'and the guest''s invitation still reports it'
);

select throws_ok(
  $$select public.submit_rsvp('40000000-0000-0000-0000-000000000020', 'maybe')$$,
  'P0001',
  null,
  'but a maybe can no longer be sent again'
);

select throws_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000020',
      '50000000-0000-0000-0000-000000000020',
      'attending',
      '[{"guest_id": "30000000-0000-0000-0000-000000000021", "status": "maybe"}]'::jsonb
    )$$,
  'P0001',
  null,
  'nor a companion''s, which the portal therefore leaves out of the reply'
);

select lives_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000020',
      '50000000-0000-0000-0000-000000000020',
      'attending',
      '[{"guest_id": "30000000-0000-0000-0000-000000000022", "status": "declined"}]'::jsonb
    )$$,
  'a firm answer still goes through, while the companion''s old maybe is left alone'
);

select results_eq(
  $$select guest_id::text, status::text from public.rsvps
     where guest_id in (
       '30000000-0000-0000-0000-000000000020',
       '30000000-0000-0000-0000-000000000021',
       '30000000-0000-0000-0000-000000000022'
     ) order by guest_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000020', 'attending'),
    ('30000000-0000-0000-0000-000000000021', 'maybe'),
    ('30000000-0000-0000-0000-000000000022', 'declined')$$,
  'a guest firms up their own answer; the companion they did not touch stays a maybe'
);

select * from finish();
rollback;
