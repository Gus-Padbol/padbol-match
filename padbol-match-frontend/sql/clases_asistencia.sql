-- Asistencia en inscripciones + política de cancelación en clases.
-- Ejecutar en Supabase SQL Editor (no se aplica automáticamente desde el repo).

ALTER TABLE public.inscripciones_clases
  ADD COLUMN IF NOT EXISTS asistio boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS asistencia_marcada_at timestamptz,
  ADD COLUMN IF NOT EXISTS asistencia_marcada_por text;

ALTER TABLE public.clases
  ADD COLUMN IF NOT EXISTS horas_cancelacion int DEFAULT 24;
