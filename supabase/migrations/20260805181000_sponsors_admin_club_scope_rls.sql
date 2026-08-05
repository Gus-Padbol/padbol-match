-- Los administradores de club sólo administran espacios publicitarios de su sede.
-- Editor de contenido y super admin conservan las capacidades globales existentes.

CREATE OR REPLACE FUNCTION public.pm_auth_manages_sponsor_venue(target_sede_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin_club', 'admin_nacional', 'super_admin')
      AND (
        ur.role IN ('admin_nacional', 'super_admin')
        OR ur.sede_id = target_sede_id
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pm_auth_manages_sponsor_venue(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_auth_manages_sponsor_venue(bigint) TO authenticated;

DROP POLICY IF EXISTS "Admin gestiona sponsors de su sede" ON public.sponsors;

CREATE POLICY "Admin gestiona sponsors de su sede"
ON public.sponsors
FOR ALL
TO authenticated
USING (
  public.pm_auth_has_admin_role(ARRAY['editor_contenido', 'super_admin', 'admin_nacional']::text[])
  OR (scope = 'sede' AND sede_id IS NOT NULL AND public.pm_auth_manages_sponsor_venue(sede_id))
)
WITH CHECK (
  public.pm_auth_has_admin_role(ARRAY['editor_contenido', 'super_admin', 'admin_nacional']::text[])
  OR (scope = 'sede' AND sede_id IS NOT NULL AND public.pm_auth_manages_sponsor_venue(sede_id))
);
