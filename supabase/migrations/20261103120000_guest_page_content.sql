-- ============================================================
-- Union v1 · The couple's own content for the guest page
--
-- What changes: three new tables the couple fills in, and one
-- guest-facing read.
--   * public.guest_pages        one row per wedding: the couple's
--                               word, how to get there, the shuttle,
--                               the dress code and its palette.
--   * public.guest_page_moments the weekend, one row per moment,
--                               placed relative to the wedding day
--                               (day before, the day, day after).
--   * public.guest_page_faq     the couple's own questions.
--   * public.get_guest_page(token) what one guest may read of it,
--                               plus the stays (room_blocks) the
--                               couple already entered.
--
-- Why: the guest hub's schedule, hotels and FAQ are written into
-- the code today, as demo content from another wedding. Every real
-- guest reads Hood River hotels. This is the content model both
-- invitation formats read (the current hub now, the wedding page
-- next), so the couple writes it once.
--
-- What is NOT here, on purpose:
--   * Anything the app already knows (names, date, venue, address,
--     RSVP deadline, hotels, carpooling, children allowed). The
--     editors and the guest read take it from where it lives, so it
--     is never typed twice and never goes stale.
--   * Photos. They need file storage readable only with a valid
--     invitation link: a later delivery.
--   * Moments reserved for a group of guests (issue #104) and a
--     draft / publish step (issue #107). Saving publishes, for now.
--
-- Who sees what: the couple and their co-organisers read and write
-- these tables through row level security (the same rule as room
-- blocks). Guests never read the tables: they go through
-- get_guest_page, which returns only what their link may see. The
-- shuttle is reserved for a household that said yes, the way the
-- exact address already can be, and is withheld by the server, not
-- hidden by the screen. Of the stays, guests get the name and the
-- price line only: the note and the status are the couple's own
-- bookkeeping ("block held until Aug 20", "Full").
-- ============================================================

-- ---------- validation helpers ----------
-- Couple-written text is a locale map, {"fr": "…", "en": "…"}, the
-- same shape as forms.rsvp_copy (see packages/shared/src/localized.ts).
-- A `$auto` array may mark machine translations. Anything else is
-- refused so a malformed value can't sit in a row looking like copy.
create or replace function public._localized_text_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null
     or (
          jsonb_typeof(p) = 'object'
          and not exists (
            select 1
            from jsonb_each(p) as e
            where not (
              (
                e.key ~ '^[a-z]{2}(-[A-Za-z0-9]{2,8})*$'
                and jsonb_typeof(e.value) = 'string'
                and char_length(e.value #>> '{}') <= 4000
              )
              or (e.key = '$auto' and jsonb_typeof(e.value) = 'array')
            )
          )
        );
$$;

comment on function public._localized_text_valid(jsonb) is
  'True when a value is null or a locale map of strings (at most 4000 characters each), with an optional $auto array. Used by the guest page content checks.';

-- At least one locale holds something other than blanks: a moment
-- or a question with no words in any language says nothing.
create or replace function public._localized_text_present(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and exists (
       select 1
       from jsonb_each(p) as e
       where e.key <> '$auto'
         and jsonb_typeof(e.value) = 'string'
         and btrim(e.value #>> '{}') <> ''
     );
$$;

comment on function public._localized_text_present(jsonb) is
  'True when a locale map holds non-blank text in at least one locale.';

-- The dress-code palette: up to six swatches, each a #RRGGBB colour
-- and an optional localized name.
create or replace function public._palette_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) <= 6
     and not exists (
       select 1
       from jsonb_array_elements(p) as s
       where jsonb_typeof(s) <> 'object'
          or coalesce(s ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$'
          or not public._localized_text_valid(s -> 'name')
          or exists (
            select 1 from jsonb_object_keys(s) as k
            where k not in ('color', 'name')
          )
     );
$$;

comment on function public._palette_valid(jsonb) is
  'True when a palette is an array of at most 6 {color: "#RRGGBB", name?: locale map} objects.';

-- Check constraints run with the privileges of whoever writes the
-- row, so the organiser's role needs to be able to call them. Guests
-- (anon) never write these tables and get nothing.
revoke all on function public._localized_text_valid(jsonb) from public, anon;
revoke all on function public._localized_text_present(jsonb) from public, anon;
revoke all on function public._palette_valid(jsonb) from public, anon;
grant execute on function public._localized_text_valid(jsonb) to authenticated;
grant execute on function public._localized_text_present(jsonb) to authenticated;
grant execute on function public._palette_valid(jsonb) to authenticated;

-- ---------- public.guest_pages ----------
create table if not exists public.guest_pages (
  wedding_id   uuid primary key references public.weddings (id) on delete cascade,
  -- Le mot: the couple's own word to their guests. Paragraphs are
  -- separated by a blank line.
  welcome      jsonb,
  -- Venir: one short text per way of getting there.
  travel_train jsonb,
  travel_plane jsonb,
  travel_car   jsonb,
  -- The shuttle. Only returned to a household that said yes.
  shuttle      jsonb,
  -- La tenue.
  dress_code   jsonb,
  dress_text   jsonb,
  dress_note   jsonb,
  palette      jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  constraint guest_pages_text_valid check (
    public._localized_text_valid(welcome)
    and public._localized_text_valid(travel_train)
    and public._localized_text_valid(travel_plane)
    and public._localized_text_valid(travel_car)
    and public._localized_text_valid(shuttle)
    and public._localized_text_valid(dress_code)
    and public._localized_text_valid(dress_text)
    and public._localized_text_valid(dress_note)
  ),
  constraint guest_pages_palette_valid check (public._palette_valid(palette))
);

comment on table public.guest_pages is
  'The couple''s own content for the guest page, one row per wedding. Guests read it through get_guest_page only.';
comment on column public.guest_pages.shuttle is
  'Shuttle details. Reserved for a household with a yes on record: get_guest_page withholds it otherwise.';

alter table public.guest_pages enable row level security;

drop policy if exists "Guest page manageable by team members" on public.guest_pages;
create policy "Guest page manageable by team members"
  on public.guest_pages for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

revoke all on table public.guest_pages from anon;

-- ---------- public.guest_page_moments ----------
create table if not exists public.guest_page_moments (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  -- Days from the wedding day: -1 the day before, 0 the day, 1 the
  -- day after. The date is computed from weddings.event_date, so
  -- moving the wedding moves the weekend with it.
  day_offset  smallint not null default 0,
  -- Local time at the venue; null for a moment with no set hour.
  starts_at   time,
  title       jsonb not null,
  place       jsonb,
  note        jsonb,
  created_at  timestamptz not null default now(),
  constraint guest_page_moments_day_offset_range check (day_offset between -3 and 3),
  constraint guest_page_moments_title_present check (
    public._localized_text_valid(title) and public._localized_text_present(title)
  ),
  constraint guest_page_moments_text_valid check (
    public._localized_text_valid(place) and public._localized_text_valid(note)
  )
);

comment on table public.guest_page_moments is
  'The weekend programme, one row per moment, placed relative to the wedding day. Guests read it through get_guest_page only.';

create index if not exists guest_page_moments_wedding_idx
  on public.guest_page_moments (wedding_id, day_offset, starts_at);

alter table public.guest_page_moments enable row level security;

drop policy if exists "Guest page moments manageable by team members" on public.guest_page_moments;
create policy "Guest page moments manageable by team members"
  on public.guest_page_moments for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

revoke all on table public.guest_page_moments from anon;

-- ---------- public.guest_page_faq ----------
create table if not exists public.guest_page_faq (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  question    jsonb not null,
  answer      jsonb not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint guest_page_faq_question_present check (
    public._localized_text_valid(question) and public._localized_text_present(question)
  ),
  constraint guest_page_faq_answer_present check (
    public._localized_text_valid(answer) and public._localized_text_present(answer)
  )
);

comment on table public.guest_page_faq is
  'The couple''s own frequently asked questions, in display order. Guests read them through get_guest_page only.';

create index if not exists guest_page_faq_wedding_idx
  on public.guest_page_faq (wedding_id, sort_order);

alter table public.guest_page_faq enable row level security;

drop policy if exists "Guest page FAQ manageable by team members" on public.guest_page_faq;
create policy "Guest page FAQ manageable by team members"
  on public.guest_page_faq for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

revoke all on table public.guest_page_faq from anon;

-- ---------- public.get_guest_page ----------
-- What one guest link may read. Same token rule as get_invitation:
-- an unknown token is an error, not an empty page.
create or replace function public.get_guest_page(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest     public.guests%rowtype;
  v_attending boolean;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  -- "Said yes" is the household's: the guest, or someone they answer
  -- for (their partner or child, or a relative they added). The same
  -- household the RSVP and the forms already use.
  select exists (
    select 1
    from public.rsvps r
    where r.status = 'attending'
      and (
        r.guest_id = v_guest.id
        or exists (
          select 1 from public.guest_relationships gr
          where gr.from_guest = v_guest.id and gr.to_guest = r.guest_id
        )
        or exists (
          select 1 from public.guests c
          where c.id = r.guest_id and c.added_by_guest_id = v_guest.id
        )
      )
  ) into v_attending;

  return jsonb_build_object(
    'page', (
      select jsonb_build_object(
        'welcome', p.welcome,
        'travel_train', p.travel_train,
        'travel_plane', p.travel_plane,
        'travel_car', p.travel_car,
        'shuttle', case when v_attending then p.shuttle end,
        'dress_code', p.dress_code,
        'dress_text', p.dress_text,
        'dress_note', p.dress_note,
        'palette', p.palette
      )
      from public.guest_pages p
      where p.wedding_id = v_guest.wedding_id
    ),
    'moments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'day_offset', m.day_offset,
          'starts_at', to_char(m.starts_at, 'HH24:MI'),
          'title', m.title,
          'place', m.place,
          'note', m.note
        )
        order by m.day_offset, m.starts_at nulls first, m.created_at
      )
      from public.guest_page_moments m
      where m.wedding_id = v_guest.wedding_id
    ), '[]'::jsonb),
    'faq', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', f.id, 'question', f.question, 'answer', f.answer)
        order by f.sort_order, f.created_at
      )
      from public.guest_page_faq f
      where f.wedding_id = v_guest.wedding_id
    ), '[]'::jsonb),
    'stays', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'name', b.name, 'price_note', b.price_note)
        order by b.sort_order, b.created_at
      )
      from public.room_blocks b
      where b.wedding_id = v_guest.wedding_id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_guest_page(uuid) is
  'The couple''s guest page content one invitation link may read: page texts (shuttle only after a household yes), moments, FAQ, and stays (name and price line only).';

revoke all on function public.get_guest_page(uuid) from public;
grant execute on function public.get_guest_page(uuid) to anon, authenticated;
