-- ============================================================
-- Union v1 · Fill in the three RSVP-side relationship RPCs
-- stubbed by 0009:
--   * submit_companion_rsvp
--   * rsvp_register_companion
--   * rsvp_merge_into
--
-- All three are SECURITY DEFINER and token-scoped; the anonymous
-- caller must hold the guest's invite_token to touch anything.
-- ============================================================

-- ---------- submit_companion_rsvp ----------
-- The token holder records an RSVP for a companion they're
-- authorised to speak for: a partner they're linked to, or a
-- child they added (either linked via parent_of, or bearing
-- added_by_guest_id pointing back at them).
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

  if p_status not in ('attending', 'declined') then
    raise exception 'Status must be attending or declined';
  end if;
  v_status := p_status::public.rsvp_status;

  select exists (
    select 1
    from public.guest_relationships gr
    where gr.from_guest = v_guest.id and gr.to_guest = v_companion.id
  ) or v_companion.added_by_guest_id = v_guest.id
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

-- ---------- rsvp_register_companion ----------
-- Adds a linked light guest on behalf of the token holder.
-- p_kind: 'partner' (an adult linked partner_of both ways) or
--         'child'   (a child linked parent_of from the token holder)
-- p_resolve:
--   'auto'         → if a plausible existing row is found in
--                    the same wedding, return the candidates
--                    (nothing is created) so the caller can
--                    ask "is this the same person?" and either
--                    call rsvp_merge_into (they picked one) or
--                    call again with 'force_create'.
--   'force_create' → skip the dedup check and create.
create or replace function public.rsvp_register_companion(
  p_token uuid,
  p_kind text,
  p_first_name text,
  p_last_name text default null,
  p_resolve text default 'auto'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest        public.guests%rowtype;
  v_wedding      public.weddings%rowtype;
  v_can_partner  boolean;
  v_can_kids     boolean;
  v_kids_used    int;
  v_kids_cap     int;
  v_new_kind     public.guest_kind;
  v_candidates   jsonb;
  v_new_id       uuid;
  v_first        text := nullif(trim(p_first_name), '');
  v_last         text := nullif(trim(coalesce(p_last_name, '')), '');
begin
  if v_first is null then
    raise exception 'First name is required';
  end if;

  if p_kind not in ('partner', 'child') then
    raise exception 'Kind must be partner or child';
  end if;

  if p_resolve not in ('auto', 'force_create') then
    raise exception 'Resolve must be auto or force_create';
  end if;

  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_wedding from public.weddings where id = v_guest.wedding_id;

  v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_kids);

  if p_kind = 'partner' then
    if not v_can_partner then
      raise exception 'Not allowed to add a partner';
    end if;
    v_new_kind := 'adult';
  else
    if not v_can_kids then
      raise exception 'Not allowed to add a child';
    end if;
    v_kids_cap := v_wedding.max_kids_per_guest;
    if v_kids_cap is not null then
      select count(*) into v_kids_used
      from public.guest_relationships gr
      join public.guests g on g.id = gr.to_guest
      where gr.from_guest = v_guest.id
        and gr.kind = 'parent_of'
        and g.kind = 'child';
      if v_kids_used >= v_kids_cap then
        raise exception 'Kids-per-guest limit reached';
      end if;
    end if;
    v_new_kind := 'child';
  end if;

  if p_resolve = 'auto' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',                  m.id,
             'first_name',          m.first_name,
             'last_name',           m.last_name,
             'kind',                m.kind,
             'added_by_first_name', ab.first_name
           )), '[]'::jsonb)
      into v_candidates
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
     where m.wedding_id = v_guest.wedding_id
       and m.kind = v_new_kind
       and lower(m.first_name) = lower(v_first)
       and (
         v_last is null
         or m.last_name is null
         or lower(m.last_name) = lower(v_last)
       );

    if jsonb_array_length(v_candidates) > 0 then
      return jsonb_build_object('status', 'candidates', 'candidates', v_candidates);
    end if;
  end if;

  insert into public.guests (wedding_id, first_name, last_name, kind, added_by_guest_id)
  values (v_guest.wedding_id, v_first, v_last, v_new_kind, v_guest.id)
  returning id into v_new_id;

  if p_kind = 'partner' then
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (v_guest.wedding_id, v_guest.id, v_new_id, 'partner_of'),
           (v_guest.wedding_id, v_new_id, v_guest.id, 'partner_of');
  else
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (v_guest.wedding_id, v_guest.id, v_new_id, 'parent_of');
  end if;

  return jsonb_build_object('status', 'created', 'guest_id', v_new_id);
end;
$$;

-- ---------- rsvp_merge_into ----------
-- Fold the token's guest row into a target guest that already
-- exists in the same wedding. Used for:
--   * "Looks like Alice already added you — is this you?"
--     on the RSVP screen (token holder merges themselves into
--     a light guest a relative created).
--   * Any future dedup UI keyed off the same token flow.
--
-- The target keeps its identity. Missing contact/profile fields
-- on the target are backfilled from the source. The source's
-- RSVP row is preserved if the target didn't have one. All
-- relationships pointing at the source are rewritten to point
-- at the target (unique conflicts silently dropped). The
-- source's invite_token is reassigned to the target so the
-- same URL keeps working, and the source row is deleted.
create or replace function public.rsvp_merge_into(
  p_token uuid,
  p_target_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source  public.guests%rowtype;
  v_target  public.guests%rowtype;
begin
  select * into v_source from public.guests where invite_token = p_token;
  if v_source.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_target from public.guests where id = p_target_guest_id;
  if v_target.id is null or v_target.wedding_id <> v_source.wedding_id then
    raise exception 'Unknown merge target';
  end if;

  if v_target.id = v_source.id then
    raise exception 'Cannot merge a guest into itself';
  end if;

  -- Backfill missing target fields from the source.
  update public.guests set
    email             = coalesce(email,             v_source.email),
    phone             = coalesce(phone,             v_source.phone),
    last_name         = coalesce(last_name,         v_source.last_name),
    profile_id        = coalesce(profile_id,        v_source.profile_id),
    added_by_guest_id = coalesce(added_by_guest_id, v_source.added_by_guest_id),
    role              = coalesce(role,              v_source.role),
    notes             = coalesce(notes,             v_source.notes),
    guest_group       = coalesce(guest_group,       v_source.guest_group),
    room_block_id     = coalesce(room_block_id,     v_source.room_block_id),
    seating_table_id  = coalesce(seating_table_id,  v_source.seating_table_id),
    -- A source that already had a login/contact info was clearly a full
    -- adult; keep the target 'adult' if either side was already adult.
    kind              = case
                          when v_target.kind = 'adult' or v_source.kind = 'adult'
                          then 'adult'::public.guest_kind
                          else v_target.kind
                        end
  where id = v_target.id;

  -- Move the RSVP only if the target doesn't have one already.
  update public.rsvps set guest_id = v_target.id
  where guest_id = v_source.id
    and not exists (select 1 from public.rsvps where guest_id = v_target.id);

  -- Rewrite relationships from source → target, keeping unique-key sanity.
  update public.guest_relationships gr
     set from_guest = v_target.id
   where gr.from_guest = v_source.id
     and gr.to_guest <> v_target.id
     and not exists (
       select 1 from public.guest_relationships x
        where x.from_guest = v_target.id
          and x.to_guest   = gr.to_guest
          and x.kind       = gr.kind
     );

  update public.guest_relationships gr
     set to_guest = v_target.id
   where gr.to_guest = v_source.id
     and gr.from_guest <> v_target.id
     and not exists (
       select 1 from public.guest_relationships x
        where x.from_guest = gr.from_guest
          and x.to_guest   = v_target.id
          and x.kind       = gr.kind
     );

  -- Rewrite added_by references pointing at the source.
  update public.guests set added_by_guest_id = v_target.id
   where added_by_guest_id = v_source.id;

  -- Give the target the source's invite_token so subsequent calls
  -- with the same URL keep resolving. Free the source's token first
  -- to keep the unique constraint happy row-by-row.
  update public.guests set invite_token = gen_random_uuid() where id = v_source.id;
  update public.guests set invite_token = v_source.invite_token where id = v_target.id;

  -- Delete the source. Any remaining edges (self-referential or dup
  -- conflicts we couldn't rewrite) cascade away.
  delete from public.guests where id = v_source.id;

  return jsonb_build_object('status', 'merged', 'guest_id', v_target.id);
end;
$$;
