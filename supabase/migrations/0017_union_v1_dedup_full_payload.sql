-- ============================================================
-- Union v1 · Include role + notes in the duplicate candidate
-- payload so the merge review panel can surface every field
-- the underlying guest row actually has.
--
-- Bug: the review panel only rendered a conflict when the two
-- candidates disagreed on a field it could see. find_duplicate_groups
-- was projecting id, name, age, email, phone, group, rsvp status,
-- added_by — so "role" and "notes" differences slipped through
-- silently (the panel saw undefined vs. undefined = no conflict).
--
-- Fix here is purely additive: extend the two jsonb builders in
-- find_duplicate_groups and list_hidden_merge_clusters to include
-- 'role' and 'notes'. The client type widens to match.
-- ============================================================

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
  v_ids      uuid[];
  v_key      text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not authorised'; end if;

  for v_guest in
    select g.id, g.first_name, g.last_name, g.age_years, g.email, g.phone,
           g.guest_group, g.role, g.notes, g.added_by_guest_id,
           r.status as rsvp_status,
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
      'role',                v_guest.role,
      'notes',               v_guest.notes,
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
    v_cluster := v_clusters -> v_i;
    if jsonb_array_length(v_cluster) >= 2 then
      select array_agg((m ->> 'id')::uuid)
        into v_ids
        from jsonb_array_elements(v_cluster) as m;
      v_key := public._cluster_key(v_ids);
      if not exists (
        select 1 from public.hidden_merge_clusters h
         where h.wedding_id = p_wedding_id and h.cluster_key = v_key
      ) then
        v_out := v_out || jsonb_build_array(v_cluster);
      end if;
    end if;
    v_i := v_i + 1;
  end loop;

  return v_out;
end;
$$;

create or replace function public.list_hidden_merge_clusters(p_wedding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_owner uuid;
  v_out   jsonb := '[]'::jsonb;
  v_h     record;
  v_ids   uuid[];
  v_arr   jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not authorised'; end if;

  for v_h in
    select cluster_key from public.hidden_merge_clusters
     where wedding_id = p_wedding_id order by hidden_at desc
  loop
    v_ids := array(select unnest(string_to_array(v_h.cluster_key, ','))::uuid);
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',                  g.id,
             'first_name',          g.first_name,
             'last_name',           g.last_name,
             'age_years',           g.age_years,
             'email',               g.email,
             'phone',               g.phone,
             'guest_group',         g.guest_group,
             'role',                g.role,
             'notes',               g.notes,
             'rsvp_status',         coalesce(r.status::text, 'pending'),
             'added_by_first_name', ab.first_name
           )), '[]'::jsonb)
      into v_arr
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
      left join public.guests ab on ab.id = g.added_by_guest_id
     where g.id = any(v_ids);
    if jsonb_array_length(v_arr) = array_length(v_ids, 1) then
      v_out := v_out || jsonb_build_array(v_arr);
    else
      delete from public.hidden_merge_clusters
       where wedding_id = p_wedding_id and cluster_key = v_h.cluster_key;
    end if;
  end loop;

  return v_out;
end;
$$;
