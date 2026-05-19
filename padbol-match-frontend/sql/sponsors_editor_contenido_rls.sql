-- Copia de supabase/migrations/20260520130000_sponsors_editor_contenido_rls.sql

DROP POLICY IF EXISTS "Editor contenido lee sponsors" ON public.sponsors;
CREATE POLICY "Editor contenido lee sponsors"
ON public.sponsors
FOR SELECT
TO authenticated
USING (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]));

DROP POLICY IF EXISTS "Editor contenido inserta sponsors" ON public.sponsors;
CREATE POLICY "Editor contenido inserta sponsors"
ON public.sponsors
FOR INSERT
TO authenticated
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]));

DROP POLICY IF EXISTS "Editor contenido actualiza sponsors" ON public.sponsors;
CREATE POLICY "Editor contenido actualiza sponsors"
ON public.sponsors
FOR UPDATE
TO authenticated
USING (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]))
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]));

DROP POLICY IF EXISTS "Editor contenido lee sedes" ON public.sedes;
CREATE POLICY "Editor contenido lee sedes"
ON public.sedes
FOR SELECT
TO authenticated
USING (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]));

DROP POLICY IF EXISTS "Editor contenido lee torneos" ON public.torneos;
CREATE POLICY "Editor contenido lee torneos"
ON public.torneos
FOR SELECT
TO authenticated
USING (public.pm_auth_has_admin_role(ARRAY['editor_contenido']::text[]));
