-- Copia de supabase/migrations/20260512210000_sponsor_aprobado_config_hub.sql
-- Ejecutar en Supabase SQL Editor si no aplicás migraciones por CLI.

ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS aprobado boolean DEFAULT false;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS descripcion text;

UPDATE public.sponsors SET aprobado = true;

CREATE TABLE IF NOT EXISTS public.sponsor_config (
  id integer PRIMARY KEY DEFAULT 1,
  max_global integer NOT NULL DEFAULT 5,
  max_por_sede_starter integer NOT NULL DEFAULT 2,
  max_por_sede_pro integer NOT NULL DEFAULT 5,
  max_por_sede_elite integer NOT NULL DEFAULT 20,
  max_por_nacion integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sponsor_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sponsor_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsor_config_super_admin_all" ON public.sponsor_config;
CREATE POLICY "sponsor_config_super_admin_all"
ON public.sponsor_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

GRANT ALL ON public.sponsor_config TO authenticated;
GRANT ALL ON public.sponsor_config TO anon;

DROP POLICY IF EXISTS "sponsors_select_public_vigentes" ON public.sponsors;
CREATE POLICY "sponsors_select_public_vigentes"
ON public.sponsors
FOR SELECT
TO anon, authenticated
USING (
  activo IS TRUE
  AND COALESCE(aprobado, false) IS TRUE
  AND (fecha_desde IS NULL OR fecha_desde <= CURRENT_DATE)
  AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
);
