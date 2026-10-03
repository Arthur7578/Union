-- ============================================================
-- Union v1 · A merge can leave the age blank
--
-- owner_merge_guests applies the owner's chosen values to the target, then
-- clears the source's copy of every field that _merge_guests folds with
-- COALESCE(target, source), so a value the owner chose to blank is not
-- refilled from the source. age_years was left out of that list: its comment
-- said _merge_guests does not coalesce it, but it has since 0014. So a
-- deliberate {"age_years": null} came back as the source's age.
--
-- Same function as 20260814184219, with age_years cleared alongside the
-- other fields. CREATE OR REPLACE keeps the existing grants.
-- ============================================================

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

  if not union_private.can_access_wedding(v_source.wedding_id) then
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
    -- target actually sticks. first_name isn't in that COALESCE list,
    -- so target's override is already final for it.
    update public.guests set
      last_name   = case when p_target_overrides ? 'last_name'   then null else last_name   end,
      email       = case when p_target_overrides ? 'email'       then null else email       end,
      phone       = case when p_target_overrides ? 'phone'       then null else phone       end,
      age_years   = case when p_target_overrides ? 'age_years'   then null else age_years   end,
      role        = case when p_target_overrides ? 'role'        then null else role        end,
      notes       = case when p_target_overrides ? 'notes'       then null else notes       end,
      guest_group = case when p_target_overrides ? 'guest_group' then null else guest_group end
    where id = v_source.id;
  end if;

  v_merged := public._merge_guests(p_source_guest_id, p_target_guest_id);
  return jsonb_build_object('status', 'merged', 'guest_id', v_merged);
end;
$$;
