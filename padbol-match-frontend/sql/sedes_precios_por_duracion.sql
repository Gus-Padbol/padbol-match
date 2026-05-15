-- Copia de padbol-backend/sql/sedes_precios_por_duracion.sql — ejecutar en Supabase por Gus.

ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_60min numeric;
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_90min numeric;
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_120min numeric;

UPDATE public.sedes
SET precio_90min = precio_turno
WHERE precio_90min IS NULL
  AND precio_turno IS NOT NULL
  AND precio_turno >= 0;
