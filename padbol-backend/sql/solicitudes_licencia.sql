CREATE TABLE IF NOT EXISTS public.solicitudes_licencia (
  id bigserial PRIMARY KEY,
  nombre_club text NOT NULL,
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
