-- ============================================================
-- Union v1 · One-source-of-truth for name similarity, plus a
-- server-side duplicate-groups RPC so the couple's dedup screen
-- and the RSVP self-merge prompt agree by construction.
--
-- Similarity rule (unchanged from the previous inline predicates):
--   same first name (case- and whitespace-insensitive) AND
--   either side's last name is null/blank OR the two last names
--   match (case- and whitespace-insensitive).
-- Rows with distinct non-null last names are NOT similar even if
-- they share a first name.
-- ============================================================

-- ---------- shared predicate ----------
create or replace function public._guest_name_matches(
  a_first text, a_last text,
  b_first text, b_last text
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
     );
$$;

revoke all on function public._guest_name_matches(text, text, text, text) from public, anon, authenticated;

-- ---------- get_invitation: use the shared predicate ----------
-- Same behaviour as 0010; only the self_merge_candidates clause
-- changes, from an inline predicate to a call to the helper.
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
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_kids);

  select count(*) into v_kids_used
  from public.guest_relationships gr
  join public.guests g on g.id = gr.to_guest
  where gr.from_guest = v_guest.id
    and gr.kind = 'parent_of'
    and g.kind = 'child';

  v_kids_cap := v_wedding.max_kids_per_guest;

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
        'kind',          v_guest.kind,
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
        'kind',          c.kind,
        'relationship',  gr.kind,
        'rsvp_status',   coalesce(cr.status, 'pending'::public.rsvp_status),
        'dietary_notes', cr.dietary_notes
      ) order by c.kind, c.first_name)
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
        'kind',                  m.kind,
        'added_by_first_name',   ab.first_name
      ))
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
      where m.wedding_id = v_guest.wedding_id
        and m.id <> v_guest.id
        and public._guest_name_matches(m.first_name, m.last_name, v_guest.first_name, v_guest.last_name)
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

-- ---------- rsvp_register_companion: use the shared predicate ----------
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
       and public._guest_name_matches(m.first_name, m.last_name, v_first, v_last);

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

-- ---------- find_duplicate_groups ----------
-- Owner-gated. Returns a JSONB array of clusters, each cluster an
-- array of guests. Clustering is greedy against the shared name
-- predicate: a guest joins an existing cluster only if it matches
-- every current member (so clusters stay internally consistent
-- even when the predicate isn't strictly transitive across null
-- last-name wildcards). Only clusters of >= 2 are returned.
-- Guests are further partitioned by kind so an adult can never
-- cluster with a child.
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
    select g.id, g.first_name, g.last_name, g.kind, g.email, g.phone,
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
      'kind',                v_guest.kind,
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
      -- Kind must match every member (each cluster is single-kind by construction).
      if (v_cluster -> 0 ->> 'kind') = v_guest.kind::text then
        v_matches := true;
        v_j := 0;
        while v_j < jsonb_array_length(v_cluster) loop
          v_member := v_cluster -> v_j;
          if not public._guest_name_matches(
               v_member ->> 'first_name',
               v_member ->> 'last_name',
               v_guest.first_name,
               v_guest.last_name
             ) then
            v_matches := false;
            exit;
          end if;
          v_j := v_j + 1;
        end loop;
      end if;

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

  -- Keep only clusters of >= 2.
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

revoke all on function public.find_duplicate_groups(uuid) from public, anon;
grant execute on function public.find_duplicate_groups(uuid) to authenticated;
