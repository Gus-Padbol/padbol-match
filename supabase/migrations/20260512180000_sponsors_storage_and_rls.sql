-- Bucket público para logos de sponsors (logos referenciados en public.sponsors.logo_url).
-- Ejecutar en Supabase SQL Editor si la migración no corre sola.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsors', 'sponsors', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Lectura pública de objetos en bucket sponsors
DROP POLICY IF EXISTS "sponsors_bucket_public_read" ON storage.objects;
CREATE POLICY "sponsors_bucket_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sponsors');

-- Usuarios autenticados: subir / actualizar / borrar logos (panel super admin en la app)
DROP POLICY IF EXISTS "sponsors_bucket_auth_write" ON storage.objects;
CREATE POLICY "sponsors_bucket_auth_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sponsors');

DROP POLICY IF EXISTS "sponsors_bucket_auth_update" ON storage.objects;
CREATE POLICY "sponsors_bucket_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sponsors')
WITH CHECK (bucket_id = 'sponsors');

DROP POLICY IF EXISTS "sponsors_bucket_auth_delete" ON storage.objects;
CREATE POLICY "sponsors_bucket_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sponsors');

-- RLS en public.sponsors (tabla ya existente en el proyecto)
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_select_public_vigentes" ON public.sponsors;
CREATE POLICY "sponsors_select_public_vigentes"
ON public.sponsors
FOR SELECT
TO anon, authenticated
USING (
  activo IS TRUE
  AND (fecha_desde IS NULL OR fecha_desde <= CURRENT_DATE)
  AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
);

DROP POLICY IF EXISTS "sponsors_super_admin_all" ON public.sponsors;
CREATE POLICY "sponsors_super_admin_all"
ON public.sponsors
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
