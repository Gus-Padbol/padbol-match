-- Padbol Match — deporte del torneo y modalidad por equipo (singles / dobles).
-- Ejecutar en Supabase SQL Editor (idempotente).
-- Padbol y Pádel: siempre dobles en app; Pickleball: singles o dobles.

ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS deporte text NOT NULL DEFAULT 'padbol';
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS formato_equipo text NOT NULL DEFAULT 'dobles';

COMMENT ON COLUMN public.torneos.deporte IS 'Deporte: padbol | padel | pickleball | squash | tenis | futbol_5 | futbol_7';
COMMENT ON COLUMN public.torneos.formato_equipo IS 'Modalidad: singles | dobles | equipo_5 | equipo_7.';

ALTER TABLE public.torneos DROP CONSTRAINT IF EXISTS torneos_deporte_chk;
ALTER TABLE public.torneos
  ADD CONSTRAINT torneos_deporte_chk CHECK (
    deporte IN ('padbol', 'padel', 'pickleball', 'squash', 'tenis', 'futbol_5', 'futbol_7')
  );

ALTER TABLE public.torneos DROP CONSTRAINT IF EXISTS torneos_formato_equipo_chk;
ALTER TABLE public.torneos
  ADD CONSTRAINT torneos_formato_equipo_chk CHECK (formato_equipo IN ('singles', 'dobles', 'equipo_5', 'equipo_7'));
