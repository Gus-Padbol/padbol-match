-- Promo del club en la pantalla Jugar (hub): una fila por sede.
-- Ejecutar en Supabase SQL Editor o como migración.

CREATE TABLE IF NOT EXISTS public.hub_promo_sede (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id integer NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  activo boolean DEFAULT false,
  imagen_url text,
  titulo text,
  subtitulo text,
  texto_boton text DEFAULT 'Ver más',
  url_destino text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT hub_promo_sede_sede_id_key UNIQUE (sede_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_promo_sede_sede_activo ON public.hub_promo_sede (sede_id) WHERE activo IS TRUE;

ALTER TABLE public.hub_promo_sede ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.hub_promo_sede TO anon;
GRANT ALL ON TABLE public.hub_promo_sede TO authenticated;

DROP POLICY IF EXISTS hub_promo_sede_select_public ON public.hub_promo_sede;
CREATE POLICY hub_promo_sede_select_public ON public.hub_promo_sede
FOR SELECT TO anon, authenticated
USING (activo IS TRUE);

DROP POLICY IF EXISTS hub_promo_sede_select_staff ON public.hub_promo_sede;
CREATE POLICY hub_promo_sede_select_staff ON public.hub_promo_sede
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin_club' AND ur.sede_id IS NOT NULL AND ur.sede_id = hub_promo_sede.sede_id)
      )
  )
);

DROP POLICY IF EXISTS hub_promo_sede_insert ON public.hub_promo_sede;
CREATE POLICY hub_promo_sede_insert ON public.hub_promo_sede
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin_club'
      AND ur.sede_id IS NOT NULL
      AND ur.sede_id = hub_promo_sede.sede_id
  )
);

DROP POLICY IF EXISTS hub_promo_sede_update ON public.hub_promo_sede;
CREATE POLICY hub_promo_sede_update ON public.hub_promo_sede
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin_club'
      AND ur.sede_id IS NOT NULL
      AND ur.sede_id = hub_promo_sede.sede_id
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin_club'
      AND ur.sede_id IS NOT NULL
      AND ur.sede_id = hub_promo_sede.sede_id
      AND hub_promo_sede.sede_id = ur.sede_id
  )
);
