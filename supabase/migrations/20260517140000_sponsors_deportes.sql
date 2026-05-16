-- Filtrado por deporte en ticker / GET /api/sponsors: columna en cada fila de `public.sponsors` (no en sponsor_config).
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS deportes text[] NULL;

COMMENT ON COLUMN public.sponsors.deportes IS
  'Slugs (padbol, padel, …); NULL o {} = global para ticker/listados sin ?deporte.';
