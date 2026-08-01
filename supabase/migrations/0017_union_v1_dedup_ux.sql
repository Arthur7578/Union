-- ============================================================
-- Union v1 · Better duplicate-review UX support.
--
-- Three things the couple needs on the dedup screen that we didn't
-- have yet:
--
-- 1. A way to hide a suggestion without deleting either row, and
--    a way to see (and unhide) the ones they've dismissed. Stored
--    server-side so the state persists across devices.
-- 2. A merge that lets the caller override the target's field
--    values first — the previous merge was pure COALESCE, which
--    means whichever row happened to have the value wins, even if
--    the other row's value was the correct one.
-- 3. No need to pick a "surviving row" from the UI. Either row
--    can be the target now; the client decides (typically the one
--    with the fuller profile). The merge folds the other into it.
--
-- A cluster is identified by the sorted list of its guest ids,
-- joined with ','. That's stable across reloads even though
-- find_duplicate_groups regenerates the cluster order.
-- ============================================================

create table public.hidden_merge_clusters (
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  cluster_key text not null,
  hidden_at   timestamptz not null default now(),
  primary key (wedding_id, cluster_key)
);
alter table public.hidden_merge_clusters enable row level security;

create policy "Hidden merge clusters selectable by wedding owner"
  on public.hidden_merge_clusters for select
  using (exists (
    select 1 from public.weddings w
    where w.id = hidden_merge_clusters.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Hidden merge clusters insertable by wedding owner"
  on public.hidden_merge_clusters for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = hidden_merge_clusters.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Hidden merge clusters deletable by wedding owner"
  on public.hidden_merge_clusters for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = hidden_merge_clusters.wedding_id and w.owner_id = auth.uid()
  ));

-- Sort a uuid[] as text and join with ','. Same rule the client
-- uses to build the cluster key.
create or replace function public._cluster_key(p_ids uuid[])
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(x, ',')
    from (
      select id::text as x
        from unnest(p_ids) as id
       order by id::text
    ) s
$$;
revoke all on function public._cluster_key(uuid[]) from public, anon, authenticated;

-- find_duplicate_groups: same as 0013, plus skip any cluster whose
-- sorted-id key sits in hidden_merge_clusters for this wedding.
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

-- list_hidden_merge_clusters: same shape as find_duplicate_groups
-- but returns only the hidden clusters, so the UI can offer to
-- restore them.
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
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;

  for v_h in
    select cluster_key
      from public.hidden_merge_clusters
     where wedding_id = p_wedding_id
     order by hidden_at desc
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
             'rsvp_status',         coalesce(r.status::text, 'pending'),
             'added_by_first_name', ab.first_name
           )), '[]'::jsonb)
      into v_arr
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
      left join public.guests ab on ab.id = g.added_by_guest_id
     where g.id = any(v_ids);
    -- Skip stale entries: if any guest in the cluster was deleted,
    -- silently drop the hidden row so the list stays truthful.
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

revoke all on function public.list_hidden_merge_clusters(uuid) from public, anon;
grant execute on function public.list_hidden_merge_clusters(uuid) to authenticated;

-- hide_duplicate_cluster / unhide: idempotent toggles keyed on the
-- sorted-id string. The client passes the raw uuid[] and the RPC
-- computes the canonical key so the two sides can't drift.
create or replace function public.hide_duplicate_cluster(
  p_wedding_id uuid,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_key   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if array_length(p_guest_ids, 1) is null or array_length(p_guest_ids, 1) < 2 then
    raise exception 'Need at least two guest ids';
  end if;
  v_key := public._cluster_key(p_guest_ids);
  insert into public.hidden_merge_clusters (wedding_id, cluster_key)
  values (p_wedding_id, v_key)
  on conflict do nothing;
end;
$$;
revoke all on function public.hide_duplicate_cluster(uuid, uuid[]) from public, anon;
grant execute on function public.hide_duplicate_cluster(uuid, uuid[]) to authenticated;

create or replace function public.unhide_duplicate_cluster(
  p_wedding_id uuid,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_key   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select owner_id into v_owner from public.weddings where id = p_wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  v_key := public._cluster_key(p_guest_ids);
  delete from public.hidden_merge_clusters
   where wedding_id = p_wedding_id and cluster_key = v_key;
end;
$$;
revoke all on function public.unhide_duplicate_cluster(uuid, uuid[]) from public, anon;
grant execute on function public.unhide_duplicate_cluster(uuid, uuid[]) to authenticated;

-- owner_merge_guests: same interface (source, target) but now
-- accepts optional p_target_overrides jsonb. Fields present on the
-- overrides object are written to target before the merge runs, so
-- the caller can resolve conflicts by picking source's value (or an
-- entirely new value) inside the same transaction — no half-merge
-- if the overrides update fails.
--
-- Whitelisted keys only, so a malformed payload can't rewrite
-- wedding_id / invite_token / id.
create or replace function public.owner_merge_guests(
  p_source_guest_id uuid,
  p_target_guest_id uuid,
  p_target_overrides jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.guests%rowtype;
  v_target public.guests%rowtype;
  v_owner  uuid;
  v_merged uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_source from public.guests where id = p_source_guest_id;
  select * into v_target from public.guests where id = p_target_guest_id;
  if v_source.id is null or v_target.id is null then
    raise exception 'Unknown source or target guest';
  end if;
  if v_source.wedding_id <> v_target.wedding_id then
    raise exception 'Guests belong to different weddings';
  end if;

  select owner_id into v_owner from public.weddings where id = v_source.wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;

  if p_target_overrides is not null and jsonb_typeof(p_target_overrides) = 'object' then
    update public.guests set
      first_name  = case when p_target_overrides ? 'first_name'
                         then nullif(trim(coalesce(p_target_overrides ->> 'first_name', '')), '')
                         else first_name end,
      last_name   = case when p_target_overrides ? 'last_name'
                         then nullif(trim(coalesce(p_target_overrides ->> 'last_name', '')), '')
                         else last_name end,
      email       = case when p_target_overrides ? 'email'
                         then nullif(trim(coalesce(p_target_overrides ->> 'email', '')), '')
                         else email end,
      phone       = case when p_target_overrides ? 'phone'
                         then nullif(trim(coalesce(p_target_overrides ->> 'phone', '')), '')
                         else phone end,
      age_years   = case when p_target_overrides ? 'age_years'
                         then nullif(p_target_overrides ->> 'age_years', '')::int
                         else age_years end,
      role        = case when p_target_overrides ? 'role'
                         then nullif(trim(coalesce(p_target_overrides ->> 'role', '')), '')
                         else role end,
      notes       = case when p_target_overrides ? 'notes'
                         then nullif(trim(coalesce(p_target_overrides ->> 'notes', '')), '')
                         else notes end,
      guest_group = case when p_target_overrides ? 'guest_group'
                         then nullif(trim(coalesce(p_target_overrides ->> 'guest_group', '')), '')
                         else guest_group end
    where id = v_target.id;

    -- For fields that _merge_guests folds via COALESCE(target,
    -- source), null out source's copy so a user-chosen null on the
    -- target actually sticks. first_name and age_years aren't in
    -- that COALESCE list, so target's override is already final for
    -- them.
    update public.guests set
      last_name   = case when p_target_overrides ? 'last_name'   then null else last_name   end,
      email       = case when p_target_overrides ? 'email'       then null else email       end,
      phone       = case when p_target_overrides ? 'phone'       then null else phone       end,
      role        = case when p_target_overrides ? 'role'        then null else role        end,
      notes       = case when p_target_overrides ? 'notes'       then null else notes       end,
      guest_group = case when p_target_overrides ? 'guest_group' then null else guest_group end
    where id = v_source.id;
  end if;

  v_merged := public._merge_guests(p_source_guest_id, p_target_guest_id);
  return jsonb_build_object('status', 'merged', 'guest_id', v_merged);
end;
$$;

revoke all on function public.owner_merge_guests(uuid, uuid, jsonb) from public, anon;
grant execute on function public.owner_merge_guests(uuid, uuid, jsonb) to authenticated;

-- Old two-arg overload would otherwise stick around and shadow the
-- new one for callers that still send only source+target.
drop function if exists public.owner_merge_guests(uuid, uuid);
