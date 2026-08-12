-- ============================================================
-- Union v1 · Grant EXECUTE on _normalize_guest_phone to
-- authenticated, and add explicit WITH CHECK to UPDATE policies
--
-- 1. guests.phone_e164 is a stored generated column whose
--    expression calls public._normalize_guest_phone(text).
--    The function had no EXECUTE privilege for `authenticated`,
--    causing every guest UPDATE to fail with "permission denied
--    for function _normalize_guest_phone".
--
-- 2. Every UPDATE RLS policy was defined with USING but no
--    WITH CHECK clause. PostgreSQL reuses USING as WITH CHECK
--    when it is omitted, so these additions are explicit
--    hardening, not strictly required. Included for clarity.
-- ============================================================

grant execute on function public._normalize_guest_phone(text) to authenticated;

-- profiles
drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- weddings
drop policy if exists "Weddings updatable by owner" on public.weddings;
create policy "Weddings updatable by owner"
  on public.weddings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- guests
drop policy if exists "Guests updatable by wedding owner" on public.guests;
create policy "Guests updatable by wedding owner"
  on public.guests for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ));

-- rsvps
drop policy if exists "Rsvps updatable by wedding owner" on public.rsvps;
create policy "Rsvps updatable by wedding owner"
  on public.rsvps for update
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ));

-- guest_groups
drop policy if exists "Guest groups updatable by wedding owner" on public.guest_groups;
create policy "Guest groups updatable by wedding owner"
  on public.guest_groups for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ));

-- room_blocks
drop policy if exists "Room blocks updatable by wedding owner" on public.room_blocks;
create policy "Room blocks updatable by wedding owner"
  on public.room_blocks for update
  using (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ));

-- seating_tables
drop policy if exists "Seating tables updatable by wedding owner" on public.seating_tables;
create policy "Seating tables updatable by wedding owner"
  on public.seating_tables for update
  using (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ));

-- guest_relationships
drop policy if exists "Guest relationships updatable by wedding owner" on public.guest_relationships;
create policy "Guest relationships updatable by wedding owner"
  on public.guest_relationships for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ));

-- forms
drop policy if exists "Forms updatable by wedding owner" on public.forms;
create policy "Forms updatable by wedding owner"
  on public.forms for update
  using (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ));