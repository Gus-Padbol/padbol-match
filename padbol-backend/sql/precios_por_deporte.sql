-- Precios por deporte/disciplina por sede (ejecutar manualmente en Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.precios_por_deporte (
  id serial PRIMARY KEY,
  sede_id integer REFERENCES public.sedes(id) ON DELETE CASCADE,
  deporte text NOT NULL,
  precio_ars numeric,
  precio_usd numeric,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sede_id, deporte)
);

CREATE INDEX IF NOT EXISTS idx_precios_por_deporte_sede_activo
  ON public.precios_por_deporte (sede_id)
  WHERE activo = true;

COMMENT ON TABLE public.precios_por_deporte IS 'Precio base por deporte en sede; reservas usan ARS o USD según moneda de la sede.';
