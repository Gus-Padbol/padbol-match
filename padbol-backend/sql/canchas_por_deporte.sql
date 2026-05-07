-- Deportes y cantidad de canchas declaradas por sede (Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.canchas_por_deporte (
  id serial PRIMARY KEY,
  sede_id integer NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  deporte text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (sede_id, deporte)
);

CREATE INDEX IF NOT EXISTS idx_canchas_por_deporte_sede_id ON public.canchas_por_deporte (sede_id);

COMMENT ON TABLE public.canchas_por_deporte IS 'Canchas declaradas por deporte por sede (límite operativo junto a sedes.cantidad_canchas)';
