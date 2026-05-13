-- Copia de supabase/migrations/20260512180000_sponsors_storage_and_rls.sql
-- Bucket público `sponsors` + políticas Storage + RLS en `public.sponsors`.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsors', 'sponsors', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "sponsors_bucket_public_read" ON storage.objects;
CREATE POLICY "sponsors_bucket_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sponsors');

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
