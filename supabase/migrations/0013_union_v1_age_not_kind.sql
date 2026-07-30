-- ============================================================
-- Union v1 · Drop guest.kind, add guest.age_years, rename kids
-- toggles to children.
--
-- The adult/child binary conflated two independent things: age
-- (which drives meal / bed decisions) and "who registers me"
-- (which is the parent_of relationship). Splitting them lets a
-- 30-year-old attend under their parents' invite without being
-- modelled as a baby, and a 6-year-old get a kids' meal without
-- affecting the registration flow. Age is the attribute; the
-- relationship is the truth about who's on whose invite.
--
-- Wedding-level toggle rename: kids → children. The RPC-side
-- p_kind='partner'|'child' parameter is kept — there it labels
-- the relationship being created (partner_of vs parent_of), not
-- the guest's age.
-- ============================================================

-- Column moves ------------------------------------------------
alter table public.guests
  add column age_years int check (age_years is null or (age_years >= 0 and age_years <= 130));

alter table public.guests drop column kind;
drop index if exists guests_kind_idx;

drop type public.guest_kind;

alter table public.weddings rename column allow_guests_add_kids to allow_guests_add_children;
alter table public.weddings rename column max_kids_per_guest    to max_children_per_guest;

-- Shared predicate --------------------------------------------
-- Same null-wildcard name rule as before, plus an age
-- disambiguator: if both ages are known and differ by 3+
-- years, the two guests are definitely different people.
-- Either side null → age is a wildcard.
drop function if exists public._guest_name_matches(text, text, text, text);

create or replace function public._guest_matches(
  a_first text, a_last text, a_age int,
  b_first text, b_last text, b_age int
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(trim(a_first)) = lower(trim(b_first))
     and (
       nullif(trim(coalesce(a_last, '')), '') is null
       or nullif(trim(coalesce(b_last, '')), '') is null
       or lower(trim(a_last)) = lower(trim(b_last))
     )
     and (a_age is null or b_age is null or abs(a_age - b_age) < 3);
$$;

revoke all on function public._guest_matches(text, text, int, text, text, int) from public, anon, authenticated;

-- get_invitation ----------------------------------------------
-- Drop kind from returned guest and companion payloads; return
-- age_years instead. self_merge_candidates uses the new helper.
create or replace function public.get_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest        public.guests%rowtype;
  v_wedding      public.weddings%rowtype;
  v_kids_used    int;
  v_kids_cap     int;
  v_can_partner  boolean;
  v_can_kids     boolean;
  v_result       jsonb;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_wedding from public.weddings where id = v_guest.wedding_id;

  v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_children);

  -- How many children the token holder has already registered
  -- (parent_of edges they originate) — this is the "kids" budget,
  -- and it's a pure relationship count now, no age gate.
  select count(*) into v_kids_used
  from public.guest_relationships gr
  where gr.from_guest = v_guest.id and gr.kind = 'parent_of';

  v_kids_cap := v_wedding.max_children_per_guest;

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one', v_wedding.partner_one,
      'partner_two', v_wedding.partner_two,
      'event_date',  v_wedding.event_date,
      'venue_name',  v_wedding.venue_name,
      'venue_address', v_wedding.venue_address
    ),
    'guest', (
      select jsonb_build_object(
        'id',            v_guest.id,
        'first_name',    v_guest.first_name,
        'last_name',     v_guest.last_name,
        'age_years',     v_guest.age_years,
        'rsvp_status',   coalesce(r.status, 'pending'::public.rsvp_status),
        'dietary_notes', r.dietary_notes,
        'message',       r.message
      )
      from (select v_guest.id as gid) self
      left join public.rsvps r on r.guest_id = self.gid
    ),
    'companions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',            c.id,
        'first_name',    c.first_name,
        'last_name',     c.last_name,
        'age_years',     c.age_years,
        'relationship',  gr.kind,
        'rsvp_status',   coalesce(cr.status, 'pending'::public.rsvp_status),
        'dietary_notes', cr.dietary_notes
      ) order by c.first_name)
      from public.guest_relationships gr
      join public.guests c on c.id = gr.to_guest
      left join public.rsvps cr on cr.guest_id = c.id
      where gr.from_guest = v_guest.id
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'can_add_partner', v_can_partner,
      'can_add_kids',    v_can_kids,
      'kids_remaining',  case
                           when not v_can_kids then 0
                           when v_kids_cap is null then null
                           else greatest(v_kids_cap - v_kids_used, 0)
                         end
    ),
    'self_merge_candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    m.id,
        'first_name',            m.first_name,
        'last_name',             m.last_name,
        'age_years',             m.age_years,
        'added_by_first_name',   ab.first_name
      ))
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
      where m.wedding_id = v_guest.wedding_id
        and m.id <> v_guest.id
        and public._guest_matches(
              m.first_name, m.last_name, m.age_years,
              v_guest.first_name, v_guest.last_name, v_guest.age_years
            )
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

-- rsvp_register_companion -------------------------------------
-- Signature unchanged (p_kind='partner'|'child' still labels the
-- relationship being created). Dedup uses the shared _guest_matches
-- helper. New children rows are inserted without a kind column;
-- age is not asked at RSVP time (parent can set it later).
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
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_children);

  if p_kind = 'partner' then
    if not v_can_partner then
      raise exception 'Not allowed to add a partner';
    end if;
  else
    if not v_can_kids then
      raise exception 'Not allowed to add a child';
    end if;
    v_kids_cap := v_wedding.max_children_per_guest;
    if v_kids_cap is not null then
      select count(*) into v_kids_used
      from public.guest_relationships gr
      where gr.from_guest = v_guest.id and gr.kind = 'parent_of';
      if v_kids_used >= v_kids_cap then
        raise exception 'Children-per-guest limit reached';
      end if;
    end if;
  end if;

  if p_resolve = 'auto' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',                  m.id,
             'first_name',          m.first_name,
             'last_name',           m.last_name,
             'age_years',           m.age_years,
             'added_by_first_name', ab.first_name
           )), '[]'::jsonb)
      into v_candidates
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
     where m.wedding_id = v_guest.wedding_id
       and public._guest_matches(m.first_name, m.last_name, m.age_years, v_first, v_last, null);

    if jsonb_array_length(v_candidates) > 0 then
      return jsonb_build_object('status', 'candidates', 'candidates', v_candidates);
    end if;
  end if;

  insert into public.guests (wedding_id, first_name, last_name, added_by_guest_id)
  values (v_guest.wedding_id, v_first, v_last, v_guest.id)
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

-- _merge_guests -----------------------------------------------
-- Drop kind coalescing; add age_years coalescing (prefer any
-- known age over null).
create or replace function public._merge_guests(
  p_source_id uuid,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source  public.guests%rowtype;
  v_target  public.guests%rowtype;
begin
  select * into v_source from public.guests where id = p_source_id;
  select * into v_target from public.guests where id = p_target_id;

  if v_source.id is null or v_target.id is null then
    raise exception 'Unknown source or target guest';
  end if;
  if v_source.wedding_id <> v_target.wedding_id then
    raise exception 'Guests belong to different weddings';
  end if;
  if v_source.id = v_target.id then
    raise exception 'Cannot merge a guest into itself';
  end if;

  update public.guests set
    email             = coalesce(email,             v_source.email),
    phone             = coalesce(phone,             v_source.phone),
    last_name         = coalesce(last_name,         v_source.last_name),
    age_years         = coalesce(age_years,         v_source.age_years),
    profile_id        = coalesce(profile_id,        v_source.profile_id),
    added_by_guest_id = coalesce(added_by_guest_id, v_source.added_by_guest_id),
    role              = coalesce(role,              v_source.role),
    notes             = coalesce(notes,             v_source.notes),
    guest_group       = coalesce(guest_group,       v_source.guest_group),
    room_block_id     = coalesce(room_block_id,     v_source.room_block_id),
    seating_table_id  = coalesce(seating_table_id,  v_source.seating_table_id)
  where id = v_target.id;

  update public.rsvps set guest_id = v_target.id
  where guest_id = v_source.id
    and not exists (select 1 from public.rsvps where guest_id = v_target.id);

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

  update public.guests set added_by_guest_id = v_target.id
   where added_by_guest_id = v_source.id;

  update public.guests set invite_token = gen_random_uuid() where id = v_source.id;
  update public.guests set invite_token = v_source.invite_token where id = v_target.id;

  delete from public.guests where id = v_source.id;

  return v_target.id;
end;
$$;

-- find_duplicate_groups ---------------------------------------
-- No kind partitioning. Age is used by the shared predicate as
-- a disambiguator, so two "Léa"s with clearly different known
-- ages don't cluster; missing age is wildcard, same as last name.
create or replace function public.find_duplicate_groups(p_wedding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_owner    uuid;
  v_guest    record;
  v_cluster  jsonb;
  v_clusters jsonb := '[]'::jsonb;
  v_row      jsonb;
  v_i        int;
  v_matches  boolean;
  v_member   jsonb;
  v_j        int;
  v_out      jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;

  for v_guest in
    select g.id, g.first_name, g.last_name, g.age_years, g.email, g.phone,
           g.guest_group, g.added_by_guest_id, r.status as rsvp_status,
           ab.first_name as added_by_first_name
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
      left join public.guests ab on ab.id = g.added_by_guest_id
     where g.wedding_id = p_wedding_id
     order by lower(g.first_name), lower(coalesce(g.last_name, ''))
  loop
    v_row := jsonb_build_object(
      'id',                  v_guest.id,
      'first_name',          v_guest.first_name,
      'last_name',           v_guest.last_name,
      'age_years',           v_guest.age_years,
      'email',               v_guest.email,
      'phone',               v_guest.phone,
      'guest_group',         v_guest.guest_group,
      'rsvp_status',         coalesce(v_guest.rsvp_status::text, 'pending'),
      'added_by_first_name', v_guest.added_by_first_name
    );

    v_i := 0;
    v_matches := false;
    while v_i < jsonb_array_length(v_clusters) loop
      v_cluster := v_clusters -> v_i;
      v_matches := true;
      v_j := 0;
      while v_j < jsonb_array_length(v_cluster) loop
        v_member := v_cluster -> v_j;
        if not public._guest_matches(
             v_member ->> 'first_name',
             v_member ->> 'last_name',
             nullif(v_member ->> 'age_years', '')::int,
             v_guest.first_name,
             v_guest.last_name,
             v_guest.age_years
           ) then
          v_matches := false;
          exit;
        end if;
        v_j := v_j + 1;
      end loop;

      if v_matches then
        v_clusters := jsonb_set(v_clusters, array[v_i::text], v_cluster || jsonb_build_array(v_row));
        exit;
      end if;
      v_i := v_i + 1;
    end loop;

    if not v_matches then
      v_clusters := v_clusters || jsonb_build_array(jsonb_build_array(v_row));
    end if;
  end loop;

  v_i := 0;
  while v_i < jsonb_array_length(v_clusters) loop
    if jsonb_array_length(v_clusters -> v_i) >= 2 then
      v_out := v_out || jsonb_build_array(v_clusters -> v_i);
    end if;
    v_i := v_i + 1;
  end loop;

  return v_out;
end;
$$;
