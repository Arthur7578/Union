-- ============================================================
-- Union v1 · Seating page made fully operational
--
-- Two additive columns on seating_tables so the couple can
-- represent things the seating screen used to render as sample
-- decorations:
--
--   * is_head   -- a "sweetheart" / head-of-room table, styled
--                  differently and stickied at the top of the plan
--   * shape     -- 'round' | 'rect' -- rectangular banquet tables
--
-- Both default so existing rows keep behaving as regular round
-- tables and the migration is safe to run any time.
-- ============================================================

alter table public.seating_tables
  add column if not exists is_head boolean not null default false,
  add column if not exists shape text not null default 'round';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seating_tables_shape_check'
  ) then
    alter table public.seating_tables
      add constraint seating_tables_shape_check
      check (shape in ('round', 'rect'));
  end if;
end $$;

-- At most one head table per wedding — the "sweetheart" is a singleton.
create unique index if not exists seating_tables_one_head_per_wedding
  on public.seating_tables (wedding_id)
  where is_head;
