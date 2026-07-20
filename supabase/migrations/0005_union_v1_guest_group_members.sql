-- ============================================================
-- Union v1 · Multi-group membership for guests.
--
-- guests.guest_group (text) stays as the guest's *primary* group so
-- the existing guest list, detail and seating screens keep working
-- with a single label per row. This new join table lets a guest
-- also appear in additional groups from the /guests/groups screen.
--
-- The Groups screen treats a guest as a member of group X when
--     guests.guest_group == X.name  OR
--     a guest_group_members row exists for (guest, X).
--
-- The primary-vs-secondary distinction is invisible to the couple:
-- it's just a compat shim for the legacy text column.
-- ============================================================

create table if not exists public.guest_group_members (
  guest_id uuid not null references public.guests(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guest_id, group_id)
);
alter table public.guest_group_members enable row level security;

create index if not exists guest_group_members_guest_id_idx
  on public.guest_group_members(guest_id);
create index if not exists guest_group_members_group_id_idx
  on public.guest_group_members(group_id);

-- Backfill: ensure a matching guest_groups row exists for every text value,
-- then seed one membership per guest from the legacy text column.
insert into public.guest_groups (wedding_id, name)
select distinct g.wedding_id, g.guest_group
from public.guests g
where g.guest_group is not null and length(trim(g.guest_group)) > 0
on conflict (wedding_id, name) do nothing;

insert into public.guest_group_members (guest_id, group_id)
select g.id, gg.id
from public.guests g
join public.guest_groups gg
  on gg.wedding_id = g.wedding_id and gg.name = g.guest_group
where g.guest_group is not null
on conflict do nothing;

-- RLS: owner-scoped via the guest's wedding.
drop policy if exists "GGM selectable by wedding owner" on public.guest_group_members;
drop policy if exists "GGM insertable by wedding owner" on public.guest_group_members;
drop policy if exists "GGM deletable by wedding owner" on public.guest_group_members;

create policy "GGM selectable by wedding owner"
  on public.guest_group_members for select
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = guest_group_members.guest_id and w.owner_id = auth.uid()
  ));

create policy "GGM insertable by wedding owner"
  on public.guest_group_members for insert
  with check (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = guest_group_members.guest_id and w.owner_id = auth.uid()
  ));

create policy "GGM deletable by wedding owner"
  on public.guest_group_members for delete
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = guest_group_members.guest_id and w.owner_id = auth.uid()
  ));
