-- ============================================================
-- Guest language: one default, one override, one guest's own pick
--
-- Localized form copy landed with a single language signal per
-- guest — guests.locale — doing three jobs at once: the couple's
-- note about which language a guest reads, the language the guest
-- picked in their portal, and, by omission, the fallback for
-- everyone else. Anything not covered fell through to the app's
-- English default, so a French couple's guests got an English
-- invitation unless someone tagged every guest one by one.
--
-- Three signals, ranked, each stored where it belongs:
--
--   * weddings.default_locale — the couple's own choice of the
--     language their guest-facing content is written for. Last in
--     line, and only reached when nothing is known about the
--     guest in front of us.
--
--   * guests.locale — the couple's override for one guest, and
--     nothing else. Null is the normal state: "we haven't said,
--     work it out". Guest-side code never writes here again.
--
--   * guests.chosen_locale (new) — the language the guest picked
--     themselves, recorded on a deliberate switch only. Beats
--     everything: a guest who reached for the switcher has told
--     us more than any guess could.
--
-- Values already in guests.locale stay put and read as the
-- couple's override. A handful may be guests' own picks written
-- by the old set_guest_locale — indistinguishable now, and it
-- changes nothing they see: both outrank browser detection, and
-- neither is reached when a guest picks a language again.
--
-- Browser detection sits between the override and the default —
-- it says something real about the reader, so it must not be
-- silently outranked by a wedding-wide fallback, and that
-- ranking lives in the app (see lib/i18n/guestLocale.ts): the
-- Accept-Language header never reaches the database.
-- ============================================================

-- ---------- weddings.default_locale ----------
-- Not null with an 'en' default so existing weddings keep
-- rendering exactly as they do today; new weddings are created
-- with whichever language the couple is planning in.
alter table public.weddings
  add column if not exists default_locale text not null default 'en'
    check (default_locale in ('en', 'fr'));

comment on column public.weddings.default_locale is
  'Language guest-facing content falls back to when nothing is known about the guest reading it. Outranked, in order, by the guest''s own pick (guests.chosen_locale), the couple''s per-guest override (guests.locale), and the guest''s browser.';

-- ---------- guests.chosen_locale ----------
alter table public.guests
  add column if not exists chosen_locale text
    check (chosen_locale is null or chosen_locale in ('en', 'fr'));

comment on column public.guests.chosen_locale is
  'The language this guest picked themselves in their invitation, or null if they never did. Written only by set_guest_locale, and only on a deliberate switch — never a guess from browser headers. Outranks every other language signal.';

comment on column public.guests.locale is
  'The couple''s language override for this one guest. Null means "no override" — the guest''s browser decides, then weddings.default_locale. Organiser-side only: a guest''s own pick lands in guests.chosen_locale so it can never overwrite what the couple recorded.';

-- ---------- get_invitation ----------
-- Rebuilt to carry both new signals: the wedding's default and
-- the guest's own recorded pick, alongside the couple's
-- override. Ranking stays client-side, where the browser's
-- Accept-Language and the guest's live switching are known.
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
      'default_locale',     v_wedding.default_locale
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

-- ---------- set_guest_locale ----------
-- Now writes guests.chosen_locale instead of guests.locale. The
-- guest's pick and the couple's override are different claims:
-- storing them in one column meant a guest glancing at the
-- language switcher erased what the couple had recorded, and
-- left the organiser's own "Language" field showing a value
-- nobody there had chosen.
create or replace function public.set_guest_locale(
  p_token uuid,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;
  if p_locale is not null and p_locale not in ('en', 'fr') then
    raise exception 'Unsupported language';
  end if;

  update public.guests set chosen_locale = p_locale where id = v_guest.id;

  return jsonb_build_object('status', 'saved', 'locale', p_locale);
end;
$$;

revoke all on function public.set_guest_locale(uuid, text) from public;
grant execute on function public.set_guest_locale(uuid, text) to anon, authenticated;

-- ---------- get_wedding_by_join_code ----------
-- The join page greets a guest before any guest record exists,
-- so the wedding's default is the only language signal it has
-- beyond the browser's own.
create or replace function public.get_wedding_by_join_code(p_join_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'partner_one', w.partner_one,
    'partner_two', w.partner_two,
    'event_date', w.event_date,
    'venue_name', w.venue_name,
    'guest_join_auth_mode', w.guest_join_auth_mode,
    'default_locale', w.default_locale
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;
