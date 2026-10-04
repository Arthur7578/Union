-- Applied migration version: 20260823155007.
-- RSVP status changes and editable RSVP-form answers used to be separate RPC
-- calls. A closed form could reject the answers after the status had already
-- committed. This endpoint owns the whole household submission so PostgreSQL
-- rolls every write back if any status or answer is invalid.
create or replace function public.submit_rsvp_response(
  p_token uuid,
  p_form_id uuid,
  p_status text,
  p_companions jsonb default '[]'::jsonb,
  p_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
  v_form public.forms%rowtype;
  v_target public.guests%rowtype;
  v_item jsonb;
  v_target_id uuid;
  v_status public.rsvp_status;
  v_allowed boolean;
begin
  select * into v_guest
  from public.guests
  where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  if coalesce(p_status, '') not in ('attending', 'declined') then
    raise exception 'Status must be attending or declined';
  end if;
  v_status := p_status::public.rsvp_status;

  if jsonb_typeof(coalesce(p_companions, '[]'::jsonb)) <> 'array' then
    raise exception 'Companions must be an array';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'Answers must be an array';
  end if;

  if p_form_id is not null then
    select * into v_form from public.forms where id = p_form_id;
    if v_form.id is null
      or v_form.wedding_id <> v_guest.wedding_id
      or v_form.kind <> 'rsvp' then
      raise exception 'Unknown RSVP form';
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
  elsif jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) > 0 then
    raise exception 'A form is required when answers are submitted';
  end if;

  -- Validate every companion before writing anything. The transaction would
  -- roll back on a later error too; validating first keeps failures precise.
  for v_item in
    select value from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb))
  loop
    begin
      v_target_id := (v_item ->> 'guest_id')::uuid;
    exception when others then
      raise exception 'Every companion needs a valid guest id';
    end;
    if v_target_id is null then
      raise exception 'Every companion needs a valid guest id';
    end if;
    if v_target_id = v_guest.id then
      raise exception 'The invited guest is not a companion';
    end if;
    if coalesce(v_item ->> 'status', '') not in ('attending', 'declined') then
      raise exception 'Companion status must be attending or declined';
    end if;

    select * into v_target from public.guests where id = v_target_id;
    select (
      v_target.id is not null
      and v_target.wedding_id = v_guest.wedding_id
      and (
        exists (
          select 1 from public.guest_relationships gr
          where gr.from_guest = v_guest.id and gr.to_guest = v_target.id
        )
        or coalesce(v_target.added_by_guest_id = v_guest.id, false)
      )
    ) into v_allowed;
    if not coalesce(v_allowed, false) then
      raise exception 'Not authorised to answer for this guest';
    end if;
  end loop;

  insert into public.rsvps (guest_id, status, responded_at)
  values (v_guest.id, v_status, now())
  on conflict (guest_id) do update
    set status = excluded.status,
        responded_at = now();

  for v_item in
    select value from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb))
  loop
    v_target_id := (v_item ->> 'guest_id')::uuid;
    v_status := (v_item ->> 'status')::public.rsvp_status;
    insert into public.rsvps (guest_id, status, responded_at)
    values (v_target_id, v_status, now())
    on conflict (guest_id) do update
      set status = excluded.status,
          responded_at = now();
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    begin
      v_target_id := (v_item ->> 'guest_id')::uuid;
    exception when others then
      raise exception 'Every answer needs a valid guest id';
    end;
    if v_target_id is null then
      raise exception 'Every answer needs a valid guest id';
    end if;
    if jsonb_typeof(coalesce(v_item -> 'answers', '{}'::jsonb)) <> 'object' then
      raise exception 'Each answer must be an object';
    end if;
    perform public.submit_form_response(
      p_token,
      p_form_id,
      coalesce(v_item -> 'answers', '{}'::jsonb),
      case when v_target_id = v_guest.id then null else v_target_id end
    );
  end loop;

  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.submit_rsvp_response(uuid, uuid, text, jsonb, jsonb) from public;
grant execute on function public.submit_rsvp_response(uuid, uuid, text, jsonb, jsonb) to anon, authenticated;

-- Include primary form availability in the small RSVP companion payload so
-- the guest page applies the same Published / Opens / Closes rules as every
-- other form. This RPC remains optional at render time: its failure must not
-- turn a valid invitation into "not found".
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
        'published', f.published,
        'opens_at', f.opens_at,
        'closes_at', f.closes_at,
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
