-- ============================================================
-- The RSVP block stops asking whatever it feels like
--
-- The RSVP block is a system block: its two reply buttons are
-- wired to real rsvp_status values in code, and 0024 gave the
-- couple control over their wording. What it never gave them was
-- control over the questions *around* the reply — a dietary
-- restrictions field for the guest, another for every companion,
-- and a message box for the couple were all hardcoded in
-- GuestPortal and shown to every guest of every wedding.
--
-- That is not a cosmetic gap. A wedding that collects meals and
-- allergies in a later "guest details" form asks the same guest
-- the same question twice, in two different places, and the two
-- answers land in two different tables (rsvps.dietary_notes and
-- form_responses.answers) with nothing to say which one the
-- caterer should believe. The couple had no way to turn either
-- off.
--
-- One jsonb map per RSVP form, keyed by field, holding only what
-- the couple has changed:
--
--   {"dietary": false, "companion_dietary": false}
--
-- An absent key means "asked" — which is what makes this
-- migration free of a backfill: '{}' is every existing RSVP
-- form's current behaviour exactly, and a field added to the
-- block later is asked for until someone turns it off. Storing
-- only the "off" decisions also keeps the couple's intent
-- legible: the row says what they chose, not what today's
-- defaults happen to be.
--
-- Scope, deliberately narrow:
--
--   * This governs what *guests are asked*, not what the couple
--     may know. Turning dietary off hides the field; it deletes
--     nothing already answered, and the organiser can still
--     record a guest's allergies by hand from that guest's page.
--   * Only the primary RSVP form carries a map. A reconfirmation
--     form reuses the primary block wholesale — same buttons,
--     same extras — exactly as it already does for the two
--     button labels, so it reads the primary's map rather than
--     keeping a second one to drift from it.
--   * 'custom' forms have no RSVP block at all; the shape is
--     pinned to '{}' for them rather than left to drift.
-- ============================================================

-- ---------- shape guard ----------
-- A function, not an inline check expression: the rules need
-- jsonb_each and a key whitelist, which a table constraint can't
-- express on its own. Immutable and search_path-pinned so it is
-- safe to call from a constraint.
create or replace function public._rsvp_fields_valid(p_fields jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_fields is null
     or (
          jsonb_typeof(p_fields) = 'object'
          -- Every key names a field the RSVP block actually renders,
          -- and every value is a plain boolean. A typo'd key would
          -- otherwise sit in the row looking effective while the
          -- question it was meant to silence keeps being asked.
          and not exists (
            select 1
            from jsonb_each(p_fields) as e
            where e.key not in ('dietary', 'companion_dietary', 'note')
               or jsonb_typeof(e.value) <> 'boolean'
          )
        );
$$;

comment on function public._rsvp_fields_valid(jsonb) is
  'True when a forms.rsvp_fields map is well formed: an object of known RSVP-block field keys to booleans. Absent key means the field is asked for. Unlike guest_modules there is no "keep at least one" rule — an RSVP that asks for nothing but the reply itself is a legitimate choice.';

-- ---------- forms.rsvp_fields ----------
alter table public.forms
  add column if not exists rsvp_fields jsonb not null default '{}'::jsonb;

comment on column public.forms.rsvp_fields is
  'Which optional fields the RSVP block asks for, as the couple''s "off" decisions only: {"dietary": false}. Absent key means asked. Only the primary rsvp-kind form is read — reconfirmation forms reuse the primary block, custom forms have no RSVP block.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forms_rsvp_fields_valid'
  ) then
    alter table public.forms
      add constraint forms_rsvp_fields_valid
      check (public._rsvp_fields_valid(rsvp_fields));
  end if;
end
$$;

-- Only the RSVP block has these fields; keep the column tidy for
-- 'custom' forms rather than letting a meaningless map accumulate
-- there and read as if it did something.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forms_rsvp_fields_empty_for_custom'
  ) then
    alter table public.forms
      add constraint forms_rsvp_fields_empty_for_custom
      check (kind = 'rsvp' or rsvp_fields = '{}'::jsonb);
  end if;
end
$$;

-- ---------- get_invitation: surface what the block asks ----------
-- Handed over as stored (only the "off" decisions), same as
-- wedding.guest_modules: the portal resolves absent keys to
-- "asked" through resolveRsvpFields, so a portal deployed before
-- this migration — and one deployed after it against a form
-- nobody has touched — both ask exactly what they asked before.
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
        'label_declined',   nullif(f.rsvp_copy -> 'label_declined', 'null'::jsonb),
        'fields',           coalesce(f.rsvp_fields, '{}'::jsonb)
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
-- The configuration this feature was built for: this wedding
-- collects dietary restrictions in a separate form, so the RSVP
-- block asking for them again — for the guest and once per
-- companion — was the duplicate ask. Turned off here so the
-- wedding is correct the moment the migration lands, same as
-- 20260820180000 did for its modules.
--
-- The message box stays: it is not collected anywhere else.
-- Nothing already answered is touched — rsvps.dietary_notes
-- keeps every note guests have given, still visible on each
-- guest's page, and turning the field back on shows it to them
-- again. Owned weddings only, and written as an upsert into the
-- existing map so it survives a re-run and doesn't discard a key
-- added by a later field.
update public.forms f
set rsvp_fields = coalesce(f.rsvp_fields, '{}'::jsonb) || jsonb_build_object(
      'dietary',           false,
      'companion_dietary', false
    )
where f.kind = 'rsvp'
  and f.purpose = 'primary'
  and f.wedding_id in (
    select w.id from public.weddings w
    where w.owner_id in (
      select u.id from auth.users u
      where lower(u.email) = 'arthurcoste75@gmail.com'
    )
  );
