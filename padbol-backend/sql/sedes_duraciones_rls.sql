-- RLS: lectura pública de duraciones activas (flujo reserva / GET /api/sedes).
-- Ejecutar en Supabase SQL Editor después de crear la tabla (sedes_duraciones.sql).

ALTER TABLE public.sedes_duraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sedes_duraciones_select_publica_activas ON public.sedes_duraciones;

CREATE POLICY sedes_duraciones_select_publica_activas
  ON public.sedes_duraciones
  FOR SELECT
  TO anon, authenticated
  USING (activo = true);

GRANT SELECT ON public.sedes_duraciones TO anon, authenticated;
