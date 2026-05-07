-- =============================================================================
-- Padbol Match — solicitudes_licencia (schema completo para alta de clubs)
-- Ejecutar en el SQL Editor de Supabase (idempotente: IF NOT EXISTS).
-- Incluye la tabla base si no existía y todas las columnas usadas por /unirse.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_licencia (
  id bigserial PRIMARY KEY,
  club_nombre text NOT NULL,
  pais text NOT NULL,
  ciudad text NOT NULL,
  responsable_nombre text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  cantidad_canchas integer NULL,
  tipo_interes text NULL,
  mensaje text NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  motivo_rechazo text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_licencia_estado_check'
  ) THEN
    ALTER TABLE public.solicitudes_licencia
      ADD CONSTRAINT solicitudes_licencia_estado_check
      CHECK (estado IN ('pendiente', 'aprobada', 'rechazada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS solicitudes_licencia_estado_idx
  ON public.solicitudes_licencia (estado, created_at DESC);

-- --- Columnas ampliadas (alta estilo Playtomic) ---

ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS club_direccion text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS provincia_estado text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS club_telefono text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS club_email text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS club_web text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS tipo_instalacion text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS horario_apertura text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS horario_cierre text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS responsable_cargo text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS nombre_legal text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS numero_fiscal text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS direccion_fiscal text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS fiscal_misma_que_club boolean NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS pais_fiscal text NULL;
ALTER TABLE public.solicitudes_licencia ADD COLUMN IF NOT EXISTS deportes_canchas jsonb NULL;

COMMENT ON COLUMN public.solicitudes_licencia.club_direccion IS 'Dirección completa del club';
COMMENT ON COLUMN public.solicitudes_licencia.tipo_instalacion IS 'indoor | outdoor | mixto';
COMMENT ON COLUMN public.solicitudes_licencia.responsable_cargo IS 'propietario | manager | otro';
COMMENT ON COLUMN public.solicitudes_licencia.deportes_canchas IS 'JSON: { deportes: [], canchas: {} }';
COMMENT ON COLUMN public.solicitudes_licencia.fiscal_misma_que_club IS 'Si true, dirección fiscal coincide con la del club';
