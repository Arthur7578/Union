-- ============================================================
-- Guest experience modules: let an organiser turn a module off
--
-- The guest invitation ships four modules — My forms, Travel &
-- board, Logistics, FAQs — and every guest saw all four whether
-- or not the couple had anything to put in them. A wedding with
-- no room blocks and no carpooling still handed its guests two
-- tabs of generic filler, which reads as "the couple forgot to
-- fill this in" rather than "this wedding doesn't need it".
--
-- One jsonb map per wedding, keyed by module, holding only what
-- the couple has changed:
--
--   {"travel": false, "logistics": false}
--
-- An absent key means "on". That is what makes this migration
-- free of a backfill: '{}' is every existing wedding's current
-- behaviour exactly, and a module added to the portal later is
-- on for everyone until someone turns it off. Storing the "off"
-- decisions only also keeps the couple's intent legible — the
-- row says what they chose, not what the defaults happen to be.
--
-- The shape is constrained rather than trusted: unknown keys and
-- non-boolean values are rejected, and so is turning off the
-- last module — an invitation with no modules at all is a broken
-- link, not a configuration. The organiser UI stops that case
-- earlier with a clearer message; the constraint is there so no
-- other writer can reach it.
-- ============================================================

-- ---------- shape guard ----------
-- A function, not an inline check expression: the rules need
-- jsonb_each and a key whitelist, which a table constraint can't
-- express on its own. Immutable and search_path-pinned so it is
-- safe to call from a constraint.
create or replace function public._guest_modules_valid(p_modules jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_modules is null
     or (
          jsonb_typeof(p_modules) = 'object'
          -- Every key names a module the guest portal actually
          -- renders, and every value is a plain boolean. A typo'd
          -- key would otherwise sit in the row looking effective
          -- while changing nothing.
          and not exists (
            select 1
            from jsonb_each(p_modules) as e
            where e.key not in ('forms', 'travel', 'logistics', 'faq')
               or jsonb_typeof(e.value) <> 'boolean'
          )
          -- At least one module survives. Absent key = on, so this
          -- only ever fails when all four are explicitly false.
          and exists (
            select 1
            from unnest(array['forms', 'travel', 'logistics', 'faq']) as k
            where coalesce(p_modules -> k = 'true'::jsonb, true)
          )
        );
$$;

comment on function public._guest_modules_valid(jsonb) is
  'True when a weddings.guest_modules map is well formed: an object of known module keys to booleans, leaving at least one module enabled. Absent key means enabled.';

-- ---------- weddings.guest_modules ----------
alter table public.weddings
  add column if not exists guest_modules jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_guest_modules_valid'
  ) then
    alter table public.weddings
      add constraint weddings_guest_modules_valid
      check (public._guest_modules_valid(guest_modules));
  end if;
end
$$;

comment on column public.weddings.guest_modules is
  'Which modules the guest invitation shows, as a map of module key to boolean. Only the couple''s "off" decisions are stored — an absent key means the module is on, so ''{}'' is the full default experience. Keys: forms, travel, logistics, faq.';

-- ---------- get_invitation ----------
-- Rebuilt only to carry guest_modules to the guest portal, which
-- decides which tabs to render. Everything else is unchanged from
-- 20260820160000_guest_language_defaults.sql.
create or replace function public.get_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest        public.guests%rowtype;
  v_wedding      public.weddings%rowtype;
  v_kids_used    int;
  v_kids_cap     int;
  v_can_partner  boolean;
  v_can_kids     boolean;
  v_address      jsonb;
  v_result       jsonb;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_wedding from public.weddings where id = v_guest.wedding_id;

  v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_children);

  select count(*) into v_kids_used
  from public.guest_relationships gr
  where gr.from_guest = v_guest.id and gr.kind = 'parent_of';

  v_kids_cap := v_wedding.max_children_per_guest;

  v_address := case v_wedding.address_visibility
    when 'full' then jsonb_build_object(
      'line',         v_wedding.address_line,
      'postal_code',  v_wedding.address_postal_code,
      'city',         v_wedding.address_city,
      'area',         null,
      'country',      v_wedding.address_country
    )
    when 'partial' then jsonb_build_object(
      'line',         null,
      'postal_code',  v_wedding.address_postal_code,
      'city',         v_wedding.address_city,
      'area',         null,
      'country',      v_wedding.address_country
    )
    when 'area' then jsonb_build_object(
      'line',         null,
      'postal_code',  null,
      'city',         null,
      'area',         v_wedding.address_area,
      'country',      v_wedding.address_country
    )
    else null
  end;

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one',        v_wedding.partner_one,
      'partner_two',        v_wedding.partner_two,
      'event_date',         v_wedding.event_date,
      'venue_name',         case
                              when v_wedding.address_visibility = 'full' then v_wedding.venue_name
                              else null
                            end,
      'address_visibility', v_wedding.address_visibility,
      'address',            v_address,
      'default_locale',     v_wedding.default_locale,
      'guest_modules',      coalesce(v_wedding.guest_modules, '{}'::jsonb)
    ),
    'guest', (
      select jsonb_build_object(
        'id',            v_guest.id,
        'first_name',    v_guest.first_name,
        'last_name',     v_guest.last_name,
        'age_years',     v_guest.age_years,
        'locale',        v_guest.locale,
        'chosen_locale', v_guest.chosen_locale,
        'rsvp_status',   coalesce(r.status, 'pending'::public.rsvp_status),
        'dietary_notes', r.dietary_notes,
        'message',       r.message
      )
      from (select v_guest.id as gid) self
      left join public.rsvps r on r.guest_id = self.gid
    ),
    'companions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',            c.id,
        'first_name',    c.first_name,
        'last_name',     c.last_name,
        'age_years',     c.age_years,
        'relationship',  gr.kind,
        'rsvp_status',   coalesce(cr.status, 'pending'::public.rsvp_status),
        'dietary_notes', cr.dietary_notes
      ) order by c.first_name)
      from public.guest_relationships gr
      join public.guests c on c.id = gr.to_guest
      left join public.rsvps cr on cr.guest_id = c.id
      where gr.from_guest = v_guest.id
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'can_add_partner', v_can_partner,
      'can_add_kids',    v_can_kids,
      'kids_remaining',  case
                           when not v_can_kids then 0
                           when v_kids_cap is null then null
                           else greatest(v_kids_cap - v_kids_used, 0)
                         end
    ),
    'self_merge_candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    m.id,
        'first_name',            m.first_name,
        'last_name',             m.last_name,
        'age_years',             m.age_years,
        'added_by_first_name',   ab.first_name
      ))
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
      where m.wedding_id = v_guest.wedding_id
        and m.id <> v_guest.id
        and public._guest_matches(
              m.first_name, m.last_name, m.age_years,
              v_guest.first_name, v_guest.last_name, v_guest.age_years
            )
    ), '[]'::jsonb),
    'rsvp_form', (
      select jsonb_build_object(
        'title',            nullif(f.rsvp_copy -> 'title', 'null'::jsonb),
        'subtitle',         nullif(f.rsvp_copy -> 'subtitle', 'null'::jsonb),
        'label_attending',  nullif(f.rsvp_copy -> 'label_attending', 'null'::jsonb),
        'label_declined',   nullif(f.rsvp_copy -> 'label_declined', 'null'::jsonb)
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'primary'
      limit 1
    ),
    'rsvp_reconfirmation', (
      select jsonb_build_object(
        'title',      nullif(f.rsvp_copy -> 'title', 'null'::jsonb),
        'subtitle',   nullif(f.rsvp_copy -> 'subtitle', 'null'::jsonb),
        'published',  f.published,
        'opens_at',   f.opens_at,
        'closes_at',  f.closes_at
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'reconfirmation'
      limit 1
    ),
    'custom_forms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',         f.id,
        'title',      f.title,
        'guest_copy', f.guest_copy,
        'questions',  f.questions,
        'published',  f.published,
        'opens_at',   f.opens_at,
        'closes_at',  f.closes_at,
        'answers',    (
          select fr.answers from public.form_responses fr
          where fr.form_id = f.id and fr.guest_id = v_guest.id
        )
      ) order by f.sort_order, f.created_at)
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'custom'
        and f.published = true
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------- arthurcoste75@gmail.com's wedding ----------
-- The first real configuration of this feature, applied here so
-- the wedding it belongs to is set up the moment the migration
-- lands: forms on, the three modules with nothing behind them
-- off. Owned weddings only — a collaborator turning modules off
-- for someone else's wedding is not what was asked for. Written
-- as an upsert into the existing map so it survives a re-run and
-- doesn't discard a key added by a later module.
update public.weddings w
set guest_modules = coalesce(w.guest_modules, '{}'::jsonb) || jsonb_build_object(
      'forms',     true,
      'travel',    false,
      'logistics', false,
      'faq',       false
    )
where w.owner_id in (
  select u.id from auth.users u
  where lower(u.email) = 'arthurcoste75@gmail.com'
);
