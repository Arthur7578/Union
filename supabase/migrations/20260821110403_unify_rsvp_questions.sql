-- ============================================================
-- One question model for RSVP and custom forms
--
-- RSVP extras used to be three fixed toggles backed by columns on
-- rsvps, while forms.questions was editable but ignored by the guest
-- experience. RSVP follow-up questions now use forms.questions and
-- form_responses, exactly like other forms. Every RSVP question is
-- answered per attendee, so an invitation holder may complete it for
-- a partner or child without question-specific delegation settings.
-- ============================================================

-- Preserve the old enabled fields as ordinary editable questions. Stable ids
-- make this rerunnable and keep backfilled answers attached when wording is
-- later changed in the builder.
update public.forms f
set questions = coalesce(f.questions, '[]'::jsonb)
  || case
       when (
         coalesce((f.rsvp_fields ->> 'dietary')::boolean, true)
         or coalesce((f.rsvp_fields ->> 'companion_dietary')::boolean, true)
       ) and not exists (
         select 1
         from jsonb_array_elements(coalesce(f.questions, '[]'::jsonb)) q
         where q ->> 'id' = 'union-rsvp-dietary'
       ) then jsonb_build_array(jsonb_build_object(
         'id', 'union-rsvp-dietary',
         'kind', 'comment',
         'title', jsonb_build_object(
           'en', 'Any dietary restrictions or allergies?',
           'fr', 'Des allergies ou un régime particulier ?'
         ),
         'required', false
       ))
       else '[]'::jsonb
     end
  || case
       when coalesce((f.rsvp_fields ->> 'note')::boolean, true)
         and not exists (
           select 1
           from jsonb_array_elements(coalesce(f.questions, '[]'::jsonb)) q
           where q ->> 'id' = 'union-rsvp-note'
         ) then jsonb_build_array(jsonb_build_object(
           'id', 'union-rsvp-note',
           'kind', 'comment',
           'title', jsonb_build_object(
             'en', 'Anything else you would like us to know?',
             'fr', 'Autre chose que vous aimeriez nous signaler ?'
           ),
           'required', false
         ))
         else '[]'::jsonb
     end
where f.kind = 'rsvp';

-- Copy every legacy value into each RSVP touchpoint that used to ask for it.
-- Existing answers win on conflict: this migration must never replace an
-- answer already submitted through the new question UI.
insert into public.form_responses (form_id, guest_id, answers, submitted_at)
select
  f.id,
  r.guest_id,
  jsonb_strip_nulls(jsonb_build_object(
    'union-rsvp-dietary', case
      when (
        coalesce((f.rsvp_fields ->> 'dietary')::boolean, true)
        or coalesce((f.rsvp_fields ->> 'companion_dietary')::boolean, true)
      ) then nullif(r.dietary_notes, '')
      else null
    end,
    'union-rsvp-note', case
      when coalesce((f.rsvp_fields ->> 'note')::boolean, true)
        then nullif(r.message, '')
      else null
    end
  )),
  coalesce(r.responded_at, now())
from public.forms f
join public.guests g on g.wedding_id = f.wedding_id
join public.rsvps r on r.guest_id = g.id
where f.kind = 'rsvp'
  and (
    (
      (
        coalesce((f.rsvp_fields ->> 'dietary')::boolean, true)
        or coalesce((f.rsvp_fields ->> 'companion_dietary')::boolean, true)
      )
      and nullif(r.dietary_notes, '') is not null
    )
    or (
      coalesce((f.rsvp_fields ->> 'note')::boolean, true)
      and nullif(r.message, '') is not null
    )
  )
on conflict (form_id, guest_id)
do update set
  answers = excluded.answers || public.form_responses.answers;

-- The old map remains for rollback compatibility, but every legacy field is
-- disabled so old application versions cannot show a second copy.
update public.forms
set rsvp_fields = jsonb_build_object(
  'dietary', false,
  'companion_dietary', false,
  'note', false
)
where kind = 'rsvp';

-- RSVP and custom forms now share the same answer endpoint. Delegation is a
-- form-level capability: always on for RSVP, optional for custom forms.
create or replace function public.submit_form_response(
  p_token uuid,
  p_form_id uuid,
  p_answers jsonb,
  p_for_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest   public.guests%rowtype;
  v_form    public.forms%rowtype;
  v_target  public.guests%rowtype;
  v_allowed boolean;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_form from public.forms where id = p_form_id;
  if v_form.id is null or v_form.wedding_id <> v_guest.wedding_id then
    raise exception 'Unknown form';
  end if;
  if v_form.kind not in ('custom', 'rsvp') then
    raise exception 'This form does not accept free-form responses';
  end if;
  if not v_form.published then
    raise exception 'This form is not open yet';
  end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then
    raise exception 'This form is not open yet';
  end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then
    raise exception 'This form is closed';
  end if;

  if p_for_guest_id is null or p_for_guest_id = v_guest.id then
    v_target := v_guest;
  else
    if v_form.kind = 'custom' and not v_form.per_person then
      raise exception 'This form is answered once per invitation';
    end if;

    select * into v_target from public.guests where id = p_for_guest_id;
    if v_target.id is null or v_target.wedding_id <> v_guest.wedding_id then
      raise exception 'Unknown guest';
    end if;

    select exists (
      select 1
      from public.guest_relationships gr
      where gr.from_guest = v_guest.id and gr.to_guest = v_target.id
    ) or coalesce(v_target.added_by_guest_id = v_guest.id, false)
    into v_allowed;

    if not v_allowed then
      raise exception 'Not authorised to answer for this guest';
    end if;
  end if;

  insert into public.form_responses (form_id, guest_id, answers)
  values (p_form_id, v_target.id, coalesce(p_answers, '{}'::jsonb))
  on conflict (form_id, guest_id)
  do update set answers = excluded.answers, submitted_at = now();

  return jsonb_build_object('status', 'saved', 'guest_id', v_target.id);
end;
$$;

revoke all on function public.submit_form_response(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.submit_form_response(uuid, uuid, jsonb, uuid) to anon, authenticated;

-- Keep the established invitation payload stable and expose only the new
-- RSVP form data through a small companion RPC. The server page merges these
-- fields before handing the invitation to the client.
create or replace function public.get_invitation_rsvp_forms(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest public.guests%rowtype;
  v_result jsonb;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select jsonb_build_object(
    'primary', (
      select jsonb_build_object(
        'id', f.id,
        'questions', coalesce(f.questions, '[]'::jsonb),
        'answers', (
          select fr.answers from public.form_responses fr
          where fr.form_id = f.id and fr.guest_id = v_guest.id
        ),
        'companion_answers', coalesce((
          select jsonb_object_agg(fr.guest_id::text, fr.answers)
          from public.form_responses fr
          where fr.form_id = f.id
            and (
              exists (
                select 1 from public.guest_relationships gr
                where gr.from_guest = v_guest.id and gr.to_guest = fr.guest_id
              )
              or exists (
                select 1 from public.guests c
                where c.id = fr.guest_id and c.added_by_guest_id = v_guest.id
              )
            )
        ), '{}'::jsonb)
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'primary'
      limit 1
    ),
    'reconfirmation', (
      select jsonb_build_object(
        'id', f.id,
        'questions', coalesce(f.questions, '[]'::jsonb),
        'answers', (
          select fr.answers from public.form_responses fr
          where fr.form_id = f.id and fr.guest_id = v_guest.id
        ),
        'companion_answers', coalesce((
          select jsonb_object_agg(fr.guest_id::text, fr.answers)
          from public.form_responses fr
          where fr.form_id = f.id
            and (
              exists (
                select 1 from public.guest_relationships gr
                where gr.from_guest = v_guest.id and gr.to_guest = fr.guest_id
              )
              or exists (
                select 1 from public.guests c
                where c.id = fr.guest_id and c.added_by_guest_id = v_guest.id
              )
            )
        ), '{}'::jsonb)
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'reconfirmation'
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_invitation_rsvp_forms(uuid) from public;
grant execute on function public.get_invitation_rsvp_forms(uuid) to anon, authenticated;
