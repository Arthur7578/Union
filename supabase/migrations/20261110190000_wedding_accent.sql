-- ============================================================
-- Union v1 · The couple's wedding colour
--
-- What changes: one nullable column, public.weddings.accent, holding
-- the key of the colour the couple picked for their wedding (one of
-- a fixed set of presets), or null for Union's neutral default.
--
-- Why: Union's interface stays neutral so that every wedding style
-- (bohemian, black tie, minimal, rustic…) feels at home; the couple's
-- own colour is what gives their planning space its personality. A
-- preset key, not a free #hex: each preset ships with tuned shades
-- that keep text and buttons readable (WCAG AA), which an arbitrary
-- colour cannot promise. The app maps keys to colours (lib/theme.ts).
--
-- Access: unchanged. The existing "Weddings updatable by team
-- members" policy already lets the owner and co-organisers update
-- their wedding row, and nobody else.
-- ============================================================

alter table public.weddings
  add column if not exists accent text;

alter table public.weddings
  drop constraint if exists weddings_accent_known;

alter table public.weddings
  add constraint weddings_accent_known check (
    accent is null
    or accent in (
      'sage', 'terracotta', 'dusty_blue', 'navy', 'burgundy',
      'rose', 'ochre', 'lilac', 'black'
    )
  );

comment on column public.weddings.accent is
  'The couple''s wedding colour: a preset key (sage, terracotta, dusty_blue, navy, burgundy, rose, ochre, lilac, black), or null for the neutral default.';
