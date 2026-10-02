-- QA ONLY — integración completa de clases/profesores.
-- Idempotente. No ejecutar en producción sin revisión y backup.

ALTER TABLE public.profesores
  ADD COLUMN IF NOT EXISTS especialidad text,
  ADD COLUMN IF NOT EXISTS nivel text,
  ADD COLUMN IF NOT EXISTS certificado_numero text,
  ADD COLUMN IF NOT EXISTS certificado_url text,
  ADD COLUMN IF NOT EXISTS certificado_estado text NOT NULL DEFAULT 'sin_documento',
  ADD COLUMN IF NOT EXISTS certificado_nota text,
  ADD COLUMN IF NOT EXISTS certificado_verificado_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificado_verificado_por uuid;

DO $$ BEGIN
  ALTER TABLE public.profesores
    ADD CONSTRAINT profesores_certificado_estado_check
    CHECK (certificado_estado IN ('sin_documento', 'pendiente', 'aprobado', 'rechazado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.clases
  ADD COLUMN IF NOT EXISTS horas_cancelacion integer NOT NULL DEFAULT 24;

ALTER TABLE public.inscripciones_clases
  ADD COLUMN IF NOT EXISTS asistio boolean,
  ADD COLUMN IF NOT EXISTS asistencia_marcada_at timestamptz,
  ADD COLUMN IF NOT EXISTS asistencia_marcada_por text;

-- Bandeja interna auditable. No dispara email, WhatsApp ni push.
CREATE TABLE IF NOT EXISTS public.clases_eventos_internos (
  id bigserial PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  clase_id bigint REFERENCES public.clases(id) ON DELETE SET NULL,
  inscripcion_id bigint REFERENCES public.inscripciones_clases(id) ON DELETE SET NULL,
  user_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('inscripcion', 'cancelacion', 'asistencia')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clases_eventos_internos_sede_created_idx
  ON public.clases_eventos_internos(sede_id, created_at DESC);

ALTER TABLE public.clases_eventos_internos ENABLE ROW LEVEL SECURITY;
-- El backend usa service-role; no se concede lectura pública directa.

-- Documentos privados: sólo el backend service-role crea URLs firmadas de corta duración.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profesor-certificados',
  'profesor-certificados',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
