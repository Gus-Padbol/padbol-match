-- Precios por duración de turno en sedes (ejecutar en Supabase SQL Editor).
-- Migra precio_turno existente a precio_90min cuando corresponda.

ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_60min numeric;
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_90min numeric;
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS precio_120min numeric;

COMMENT ON COLUMN public.sedes.precio_60min IS 'Precio turno 60 min; NULL = no se ofrece esa duración en reservas';
COMMENT ON COLUMN public.sedes.precio_90min IS 'Precio turno 90 min; NULL = no se ofrece';
COMMENT ON COLUMN public.sedes.precio_120min IS 'Precio turno 120 min; NULL = no se ofrece';

-- Backfill: copiar precio_turno legado a 90 min si aún no hay precio_90min
UPDATE public.sedes
SET precio_90min = precio_turno
WHERE precio_90min IS NULL
  AND precio_turno IS NOT NULL
  AND precio_turno >= 0;
