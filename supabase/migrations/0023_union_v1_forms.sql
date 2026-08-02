-- ============================================================
-- Union v1 · Forms
--
-- Generalizes the single "custom RSVP questions" column on weddings
-- into a proper forms table, so a couple can run several forms across
-- the engagement (RSVP now, a details form once people are coming, a
-- final headcount close to the day) — each with its own schedule and
-- draft/live status.
--
--   * forms   -- one row per form; questions is the same shape that
--               used to live on weddings.rsvp_form_questions
--
-- Exactly one 'rsvp' kind form is allowed per wedding — it's the form
-- wired to the real guest RSVP flow (attend/decline, dietary, plus
-- companions). Other forms are 'custom': organiser-side scaffolding
-- for now (schedule + question planning); answering them from the
-- guest portal is a follow-up, same as rsvp_form_questions was before
-- this migration.
--
-- weddings.rsvp_form_questions is left in place (unused going
-- forward) rather than dropped, to avoid touching existing data.
-- ============================================================

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  kind text not null default 'custom' check (kind in ('rsvp', 'custom')),
  title text not null,
  published boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  questions jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.forms enable row level security;
create index if not exists forms_wedding_id_idx on public.forms (wedding_id);

-- Only one RSVP-kind form per wedding — it's the one tied to the real
-- guest RSVP flow, so there's no meaningful way to have two.
create unique index if not exists forms_one_rsvp_per_wedding
  on public.forms (wedding_id)
  where (kind = 'rsvp');

-- ---------- RLS (owner-scoped via the parent wedding) ----------
drop policy if exists "Forms selectable by wedding owner" on public.forms;
drop policy if exists "Forms insertable by wedding owner" on public.forms;
drop policy if exists "Forms updatable by wedding owner" on public.forms;
drop policy if exists "Forms deletable by wedding owner" on public.forms;

create policy "Forms selectable by wedding owner"
  on public.forms for select
  using (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Forms insertable by wedding owner"
  on public.forms for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Forms updatable by wedding owner"
  on public.forms for update
  using (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Forms deletable by wedding owner"
  on public.forms for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = forms.wedding_id and w.owner_id = auth.uid()
  ));

-- ---------- data migration ----------
-- Give every existing wedding its RSVP form, carrying over any custom
-- questions it already had. Published with no schedule = always open,
-- matching how the RSVP flow behaved before forms existed.
insert into public.forms (wedding_id, kind, title, published, questions, sort_order)
select w.id, 'rsvp', 'RSVP', true, coalesce(w.rsvp_form_questions, '[]'::jsonb), 0
from public.weddings w
where not exists (
  select 1 from public.forms f where f.wedding_id = w.id and f.kind = 'rsvp'
);
