-- A guest can have at most one outgoing partner relationship. The guest
-- portal already hides its add-partner control after the first relationship;
-- this index makes the same rule authoritative for every write path and
-- closes the race between concurrent RSVP submissions.
create unique index guest_relationships_one_partner_per_guest
  on public.guest_relationships (from_guest)
  where kind = 'partner_of';

-- Keep the RPC's error actionable for the normal sequential case. The unique
-- index above remains the final guard if two requests race this check.
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
    if exists (
      select 1
      from public.guest_relationships gr
      where gr.from_guest = v_guest.id and gr.kind = 'partner_of'
    ) then
      raise exception 'Guest already has a partner';
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
