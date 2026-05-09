-- Padbol Match — deporte del torneo y modalidad por equipo (singles / dobles).
-- Ejecutar en Supabase SQL Editor (idempotente).
-- Copia alineada con padbol-match-frontend/sql/torneos_deporte_formato_equipo.sql

ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS deporte text NOT NULL DEFAULT 'padbol';
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS formato_equipo text NOT NULL DEFAULT 'dobles';

COMMENT ON COLUMN public.torneos.deporte IS 'Deporte: padbol | padel | pickleball';
COMMENT ON COLUMN public.torneos.formato_equipo IS 'Modalidad: singles (1v1) | dobles (2v2).';

ALTER TABLE public.torneos DROP CONSTRAINT IF EXISTS torneos_deporte_chk;
ALTER TABLE public.torneos
  ADD CONSTRAINT torneos_deporte_chk CHECK (deporte IN ('padbol', 'padel', 'pickleball'));

ALTER TABLE public.torneos DROP CONSTRAINT IF EXISTS torneos_formato_equipo_chk;
ALTER TABLE public.torneos
  ADD CONSTRAINT torneos_formato_equipo_chk CHECK (formato_equipo IN ('singles', 'dobles'));
