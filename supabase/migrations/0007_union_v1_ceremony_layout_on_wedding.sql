-- ============================================================
-- Union v1 · Ceremony layout is wedding-scoped, not per-device
--
-- The Seating page used to keep the ceremony layout (row count,
-- reserved rows) in each browser's localStorage. That broke the
-- moment two collaborators opened the same wedding on different
-- devices — each one saw their own shape.
--
-- Moving the two fields onto the wedding row means every
-- collaborator sees the same layout the moment a change lands.
-- ============================================================

alter table public.weddings
  add column if not exists ceremony_rows int not null default 6,
  add column if not exists ceremony_reserved_rows int not null default 1;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weddings_ceremony_rows_range'
  ) then
    alter table public.weddings
      add constraint weddings_ceremony_rows_range
      check (ceremony_rows between 2 and 24);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'weddings_ceremony_reserved_within_rows'
  ) then
    alter table public.weddings
      add constraint weddings_ceremony_reserved_within_rows
      check (
        ceremony_reserved_rows >= 0
        and ceremony_reserved_rows <= ceremony_rows
      );
  end if;
end $$;
