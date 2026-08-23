begin;

-- Editable RSVP questions, delegated household answers, and atomic status +
-- answer submission share one response model.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- One wedding, one household: a guest with a partner and a child they may
-- answer for, plus an unrelated guest of the same wedding to prove one
-- household can never answer for another.
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000010', 'asks-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two)
values (
  '20000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000010',
  'Asks',
  'Owner'
);

insert into public.guests (id, wedding_id, invite_token, first_name)
values
  (
    '30000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000010',
    'Invited guest'
  ),
  (
    '30000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000011',
    'Their partner'
  ),
  (
    '30000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000012',
    'Their child'
  ),
  -- added_by_guest_id stays null, as it does for every guest the couple
  -- imports themselves. That null is what used to make the authorisation
  -- check on both submit RPCs evaluate to null instead of false.
  (
    '30000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000013',
    'Unrelated guest'
  );

insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
values
  (
    '20000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000011',
    'partner_of'
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000012',
    'parent_of'
  );

insert into public.forms (id, wedding_id, kind, purpose, title, published)
values
  (
    '50000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000010',
    'rsvp',
    'primary',
    'RSVP',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000010',
    'rsvp',
    'reconfirmation',
    'Final check',
    true
  );

insert into public.forms (id, wedding_id, kind, title, published, per_person, questions)
values
  (
    '50000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000010',
    'custom',
    'Guest details',
    true,
    true,
    '[{"id": "q-meal", "kind": "single", "title": {"en": "Meal"}, "required": false,
       "options": [{"id": "o-fish", "label": {"en": "Fish"}}]}]'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000010',
    'custom',
    'Songs',
    true,
    false,
    '[]'::jsonb
  );

update public.forms
set questions = '[{"id": "q-allergy", "kind": "comment", "title": {"en": "Allergies"}, "required": false}]'::jsonb
where id = '50000000-0000-0000-0000-000000000010';

select throws_ok(
  $$update public.forms
      set per_person = true
      where id = '50000000-0000-0000-0000-000000000010'$$,
  '23514',
  null,
  'an RSVP form cannot be marked per-person — its block always is'
);

-- ---------- RSVP questions use the same per-attendee response model ----------

select lives_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000010',
      '{"q-allergy": "none"}'::jsonb
    )$$,
  'the invited guest can answer the RSVP follow-up questions'
);

select lives_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000010',
      '{"q-allergy": "peanuts"}'::jsonb,
      '30000000-0000-0000-0000-000000000012'
    )$$,
  'the invitation holder can answer the whole RSVP form for their child'
);

select is(
  public.get_invitation_rsvp_forms('40000000-0000-0000-0000-000000000010')
    #> '{primary,questions,0,title,en}',
  '"Allergies"'::jsonb,
  'the invitation receives the configured RSVP question'
);

select is(
  public.get_invitation_rsvp_forms('40000000-0000-0000-0000-000000000010')
    #> '{primary,companion_answers,30000000-0000-0000-0000-000000000012}',
  '{"q-allergy": "peanuts"}'::jsonb,
  'the invitation reopens on the child''s RSVP answers'
);

select throws_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000010',
      '{}'::jsonb,
      '30000000-0000-0000-0000-000000000013'
    )$$,
  'P0001',
  'Not authorised to answer for this guest',
  'RSVP delegation is limited to the invitation holder''s relatives'
);

-- ---------- answering a form for yourself and your relatives ----------

select lives_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000012',
      '{"q-meal": "o-fish"}'::jsonb
    )$$,
  'a guest answers a per-person form for themselves'
);

select lives_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000012',
      '{"q-meal": "o-fish"}'::jsonb,
      '30000000-0000-0000-0000-000000000012'
    )$$,
  'and for the child they are bringing'
);

select is(
  (select count(*)::int from public.form_responses
    where form_id = '50000000-0000-0000-0000-000000000012'),
  2,
  'each person''s answers are their own row'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000010')
    #> '{custom_forms,0,companion_answers,30000000-0000-0000-0000-000000000012}',
  '{"q-meal": "o-fish"}'::jsonb,
  'the invitation reopens on what was already answered for a relative'
);

select is(
  public.get_invitation('40000000-0000-0000-0000-000000000013')
    #> '{custom_forms,0,companion_answers}',
  '{}'::jsonb,
  'another household sees none of those answers'
);

select throws_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000012',
      '{}'::jsonb,
      '30000000-0000-0000-0000-000000000013'
    )$$,
  'P0001',
  'Not authorised to answer for this guest',
  'a guest cannot answer for an unrelated guest of the same wedding'
);

select throws_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000013',
      '{}'::jsonb,
      '30000000-0000-0000-0000-000000000011'
    )$$,
  'P0001',
  'This form is answered once per invitation',
  'a household-scoped form takes no answers on someone else''s behalf'
);

select lives_ok(
  $$select public.submit_form_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000013',
      '{}'::jsonb,
      '30000000-0000-0000-0000-000000000010'
    )$$,
  'passing your own id is the ordinary self path, not a delegation'
);

-- ---------- the same authorisation rule on the RSVP path ----------
-- Both RPCs share the rule, and shared it while it was broken: with
-- added_by_guest_id null, `... or added_by_guest_id = v_guest.id` was null
-- rather than false, so `if not v_allowed` never fired and any guest could
-- reply — and set dietary notes — for any other guest of the wedding.

select lives_ok(
  $$select public.submit_companion_rsvp(
      '40000000-0000-0000-0000-000000000010',
      '30000000-0000-0000-0000-000000000011',
      'attending',
      'no nuts'
    )$$,
  'a guest still replies for their own partner'
);

select throws_ok(
  $$select public.submit_companion_rsvp(
      '40000000-0000-0000-0000-000000000010',
      '30000000-0000-0000-0000-000000000013',
      'attending',
      'anything at all'
    )$$,
  'P0001',
  'Not authorised to answer for this guest',
  'a guest cannot RSVP for an unrelated guest of the same wedding'
);

-- ---------- atomic household RSVP + form answers ----------

select lives_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000010',
      'attending',
      '[
        {"guest_id": "30000000-0000-0000-0000-000000000011", "status": "attending"},
        {"guest_id": "30000000-0000-0000-0000-000000000012", "status": "declined"}
      ]'::jsonb,
      '[
        {"guest_id": "30000000-0000-0000-0000-000000000010", "answers": {"q-allergy": "shellfish"}},
        {"guest_id": "30000000-0000-0000-0000-000000000012", "answers": {}}
      ]'::jsonb
    )$$,
  'one RPC saves the household statuses and RSVP answers'
);

select is(
  (select status::text from public.rsvps
    where guest_id = '30000000-0000-0000-0000-000000000010'),
  'attending',
  'the primary status was saved'
);

select is(
  (select status::text from public.rsvps
    where guest_id = '30000000-0000-0000-0000-000000000012'),
  'declined',
  'the companion status was saved in the same transaction'
);

select is(
  (select answers ->> 'q-allergy' from public.form_responses
    where form_id = '50000000-0000-0000-0000-000000000010'
      and guest_id = '30000000-0000-0000-0000-000000000010'),
  'shellfish',
  'the primary RSVP answer was saved'
);

select is(
  (select answers from public.form_responses
    where form_id = '50000000-0000-0000-0000-000000000010'
      and guest_id = '30000000-0000-0000-0000-000000000012'),
  '{}'::jsonb,
  'an explicit blank optional response is stored for completion tracking'
);

update public.forms
set closes_at = now() - interval '1 minute'
where id = '50000000-0000-0000-0000-000000000010';

select throws_ok(
  $$select public.submit_rsvp_response(
      '40000000-0000-0000-0000-000000000010',
      '50000000-0000-0000-0000-000000000010',
      'declined',
      '[]'::jsonb,
      '[]'::jsonb
    )$$,
  'P0001',
  'This form is closed',
  'a closed RSVP form rejects the whole submission'
);

select is(
  (select status::text from public.rsvps
    where guest_id = '30000000-0000-0000-0000-000000000010'),
  'attending',
  'a rejected form leaves the previously saved status unchanged'
);

select is(
  public.get_invitation_rsvp_forms('40000000-0000-0000-0000-000000000010')
    #> '{primary,closes_at}',
  to_jsonb((select closes_at from public.forms
    where id = '50000000-0000-0000-0000-000000000010')),
  'the guest payload exposes the primary form availability window'
);

select * from finish();
rollback;
