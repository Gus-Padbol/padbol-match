-- Lectura de límites de sponsors para admin club / roles autenticados (sin datos sensibles).
-- Necesario para "Mis sponsors disponibles" en Mi Sede.

DROP POLICY IF EXISTS "sponsor_config_select_read_limits" ON public.sponsor_config;

CREATE POLICY "sponsor_config_select_read_limits"
ON public.sponsor_config
FOR SELECT
TO authenticated
USING (true);
