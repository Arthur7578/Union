-- ============================================================
-- Union v1 · The "maybe" RSVP option, opt-in per wedding
--
-- 20261012164927 widened public.rsvp_status with 'maybe'. This
-- migration decides who gets to use it, and what happens when
-- they do.
--
-- Why it is opt-in rather than always on: a third button changes
-- what an RSVP *means*. Some couples need a firm headcount for a
-- caterer on a deadline and would rather chase an unsure guest
-- than bank an unsure yes; others are running a two-day event
-- where half the guest list genuinely cannot know yet. Neither
-- is wrong, so the couple decides — and until they do, the RSVP
-- behaves exactly as it did before this migration.
--
-- Where the switch lives: weddings.allow_rsvp_maybe. It is a
-- property of the wedding, not of one form — the same answer set
-- has to hold for the primary RSVP, the late reconfirmation, and
-- the household reply, or the counts on the guest list stop
-- adding up. The guest-facing *wording* for the button stays in
-- forms.rsvp_copy with its two siblings; only the behaviour is
-- here.
--
-- What it does NOT do: turning the option off later never
-- rewrites replies already given. A 'maybe' on record stays a
-- 'maybe' until that guest answers again — silently converting
-- it to attending or declined would invent a commitment the guest
-- never made, which is the exact failure this feature exists to
-- prevent. New 'maybe' replies are simply refused while the
-- option is off.
--
-- Every function below is rebuilt from the definition the
-- database runs today — checked against production by hashing
-- each function body before this file was written — with only
-- the lines named in its own comment changed. Nothing else in
-- them moves.
-- ============================================================

-- ---------- guard ----------
-- The four functions rebuilt below are replaced whole, so if one of them
-- has been edited since this file was written, replacing it would silently
-- undo that edit. Refuse instead, and say which one: its section needs
-- rebuilding from the current definition.
do $guard$
declare
  v_fn       text;
  v_expected text;
  v_actual   text;
begin
  for v_fn, v_expected in
    select * from (values
      ('submit_rsvp',            '45184299b3423510ffdfa52184b8223f'),
      ('submit_companion_rsvp',  '5f0b6634902946eea25f1a27aac15c8b'),
      ('submit_rsvp_response',   'e61e4fa545345c139015cb874f6f8ba9'),
      ('log_rsvp_status_change', 'f5146ab4f2dff1496c4b539a863028ef')
    ) as t(fn, expected)
  loop
    select md5(p.prosrc) into v_actual
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_fn;
    if v_actual is distinct from v_expected then
      raise exception 'public.% has changed since this migration was written; rebuild its section from the current definition rather than overwriting it', v_fn;
    end if;
  end loop;
end
$guard$;

-- ---------- the switch ----------
alter table public.weddings
  add column if not exists allow_rsvp_maybe boolean not null default false;

comment on column public.weddings.allow_rsvp_maybe is
  'Whether guests of this wedding may answer "maybe" as well as attending/declined. Off by default: a third answer changes what the headcount means, so the couple opts in. Turning it off stops new "maybe" replies but never rewrites ones already given.';

-- ---------- who may answer 'maybe' ----------
-- One place every guest-facing submit path asks, so the guest RSVP,
-- a companion RSVP and the household reply can never disagree about
-- which answers exist. (The organiser edits a guest's reply directly
-- on the rsvps table under their own row-level access; that path does
-- not go through here.)
create or replace function public._rsvp_status_allowed(
  p_wedding_id uuid,
  p_status text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_status in ('attending', 'declined') then true
    when p_status = 'maybe' then coalesce(
      (select w.allow_rsvp_maybe from public.weddings w where w.id = p_wedding_id),
      false
    )
    else false
  end;
$$;

revoke all on function public._rsvp_status_allowed(uuid, text) from public, anon, authenticated;

-- ---------- submit_rsvp ----------
-- Unchanged from 0010 except that the hardcoded two-answer check
-- becomes the wedding's own answer set.
create or replace function public.submit_rsvp(
  p_token uuid,
  p_status text,
  p_dietary_notes text default null,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_id   uuid;
  v_wedding_id uuid;
  v_status     public.rsvp_status;
begin
  select id, wedding_id into v_guest_id, v_wedding_id
  from public.guests where invite_token = p_token;
  if v_guest_id is null then
    raise exception 'Invalid invitation token';
  end if;

  if not public._rsvp_status_allowed(v_wedding_id, p_status) then
    raise exception 'Status % is not an answer this wedding accepts', p_status;
  end if;
  v_status := p_status::public.rsvp_status;

  insert into public.rsvps (guest_id, status, dietary_notes, message, responded_at)
  values (v_guest_id, v_status, p_dietary_notes, p_message, now())
  on conflict (guest_id) do update
    set status        = excluded.status,
        dietary_notes = excluded.dietary_notes,
        message       = excluded.message,
        responded_at  = now();
end;
$$;

-- ---------- submit_companion_rsvp ----------
-- Unchanged from 20260821102943 (which already guards against a
-- guest nobody added) except for the same answer-set check.
create or replace function public.submit_companion_rsvp(
  p_token uuid,
  p_companion_guest_id uuid,
  p_status text,
  p_dietary_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest      public.guests%rowtype;
  v_companion  public.guests%rowtype;
  v_status     public.rsvp_status;
  v_allowed    boolean;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_companion from public.guests where id = p_companion_guest_id;
  if v_companion.id is null or v_companion.wedding_id <> v_guest.wedding_id then
    raise exception 'Unknown companion';
  end if;

  if not public._rsvp_status_allowed(v_guest.wedding_id, p_status) then
    raise exception 'Status % is not an answer this wedding accepts', p_status;
  end if;
  v_status := p_status::public.rsvp_status;

  select exists (
    select 1
    from public.guest_relationships gr
    where gr.from_guest = v_guest.id and gr.to_guest = v_companion.id
  ) or coalesce(v_companion.added_by_guest_id = v_guest.id, false)
  into v_allowed;

  if not v_allowed then
    raise exception 'Not authorised to answer for this guest';
  end if;

  insert into public.rsvps (guest_id, status, dietary_notes, responded_at)
  values (v_companion.id, v_status, p_dietary_notes, now())
  on conflict (guest_id) do update
    set status        = excluded.status,
        dietary_notes = excluded.dietary_notes,
        responded_at  = now();

  return jsonb_build_object('status', 'ok', 'guest_id', v_companion.id);
end;
$$;

-- ---------- submit_rsvp_response ----------
-- The one the guest portal actually calls: the whole household's
-- reply in a single transaction. Unchanged from 20260823155007
-- except that both the guest's own status and each companion's
-- are checked against the wedding's answer set.
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

  if not public._rsvp_status_allowed(v_guest.wedding_id, p_status) then
    raise exception 'Status % is not an answer this wedding accepts', p_status;
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
    if not public._rsvp_status_allowed(v_guest.wedding_id, v_item ->> 'status') then
      raise exception 'Companion status % is not an answer this wedding accepts', v_item ->> 'status';
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

-- ---------- activity_log ----------
-- A guest moving to "maybe" is the most useful RSVP event in the
-- log, not the least: it is the one that tells a co-organiser
-- there is a conversation still to have. It gets its own key
-- rather than folding into attending/declined.
alter table public.activity_log
  drop constraint if exists activity_log_action_key_valid;
alter table public.activity_log
  add constraint activity_log_action_key_valid check (
    action_key in (
      'guest_added',
      'rsvp_attending',
      'rsvp_maybe',
      'rsvp_declined',
      'collaborator_invited',
      'collaborator_joined',
      'autonomy_changed',
      'legacy'
    )
  );

-- Unchanged from 20260814184219 except that a maybe is logged
-- as its own event.
create or replace function public.log_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_name text;
  v_action_key text;
  v_action_text text;
begin
  if TG_OP = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('attending', 'maybe', 'declined') then
    return new;
  end if;

  v_action_key := case new.status
    when 'attending' then 'rsvp_attending'
    when 'maybe'     then 'rsvp_maybe'
    else 'rsvp_declined'
  end;
  v_action_text := case new.status
    when 'attending' then 'RSVP''d yes'
    when 'maybe'     then 'RSVP''d maybe'
    else 'RSVP''d no'
  end;

  begin
    select trim(first_name || ' ' || coalesce(last_name, '')) into v_guest_name
    from public.guests where id = new.guest_id;

    insert into public.activity_log (
      wedding_id, actor_kind, actor_label, action_key, action_data, action_text
    )
    select
      g.wedding_id,
      'person',
      coalesce(v_guest_name, 'A guest'),
      v_action_key,
      '{}'::jsonb,
      v_action_text
    from public.guests g where g.id = new.guest_id;
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- ---------- get_invitation ----------
-- Patched in place rather than rebuilt: this function has been edited by
-- several migrations (the RSVP questions, the welcome screen, ...), and the
-- definition the database runs is the sum of them — no single file holds it.
-- Two additions:
--   * wedding.allow_rsvp_maybe — whether the guest portal offers
--     a third button at all. It sits on the wedding rather than
--     inside rsvp_form because a wedding may have no forms row
--     yet, and "no custom wording" must not silently mean "no
--     maybe option".
--   * rsvp_form.label_maybe — the couple's wording for that
--     button, alongside its two siblings. Blank means "use the
--     system default", exactly as for the other labels.
do $migration$
declare
  d text := pg_get_functiondef('public.get_invitation(uuid)'::regprocedure);
begin
  if position('allow_rsvp_maybe' in d) > 0 then
    return;
  end if;

  d := replace(
    d,
    $a$'guest_modules',      coalesce(v_wedding.guest_modules, '{}'::jsonb)$a$,
    $a$'guest_modules',      coalesce(v_wedding.guest_modules, '{}'::jsonb),
      'allow_rsvp_maybe',   v_wedding.allow_rsvp_maybe$a$
  );
  if position('allow_rsvp_maybe' in d) = 0 then
    raise exception 'get_invitation no longer has the expected wedding block; patch this migration';
  end if;

  d := replace(
    d,
    $a$'label_attending',  nullif(f.rsvp_copy -> 'label_attending', 'null'::jsonb),$a$,
    $a$'label_attending',  nullif(f.rsvp_copy -> 'label_attending', 'null'::jsonb),
        'label_maybe',      nullif(f.rsvp_copy -> 'label_maybe', 'null'::jsonb),$a$
  );
  if position('label_maybe' in d) = 0 then
    raise exception 'get_invitation no longer has the expected rsvp_form block; patch this migration';
  end if;

  execute d;
end
$migration$;

-- ---------- grants ----------
revoke all on function public.get_invitation(uuid) from public;
revoke all on function public.submit_rsvp(uuid, text, text, text) from public;
revoke all on function public.submit_companion_rsvp(uuid, uuid, text, text) from public;
revoke all on function public.submit_rsvp_response(uuid, uuid, text, jsonb, jsonb) from public;
grant execute on function public.get_invitation(uuid)                                    to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, text, text)                     to anon, authenticated;
grant execute on function public.submit_companion_rsvp(uuid, uuid, text, text)           to anon, authenticated;
grant execute on function public.submit_rsvp_response(uuid, uuid, text, jsonb, jsonb)    to anon, authenticated;
