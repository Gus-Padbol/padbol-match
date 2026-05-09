-- Zona horaria IANA por sede (reservas, horarios pasados, recordatorios).
-- Ejecutar en Supabase SQL Editor (idempotente).

ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Argentina/Buenos_Aires';

COMMENT ON COLUMN public.sedes.timezone IS
  'IANA TZ para calendario de reservas (ej. America/Argentina/Buenos_Aires, America/New_York, Europe/Madrid).';

UPDATE public.sedes SET timezone = 'America/New_York' WHERE lower(trim(ciudad)) = 'miami';
UPDATE public.sedes SET timezone = 'Europe/Madrid' WHERE lower(trim(ciudad)) = 'madrid';
