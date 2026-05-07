-- Torneos: columna canónica para tipo de competencia (Masculino / Femenino / Mixto).
--
-- Importante: NO usar el nombre `tipo_torneo` para M/F/Mixto. En esta base, `tipo_torneo`
-- es el formato del torneo (round_robin, grupos_knockout, etc.).
--
-- `genero_competencia` es el nombre histórico de la misma idea; se puede dejar en la tabla
-- por compatibilidad. Este script rellena `tipo_competencia` desde `genero_competencia` cuando
-- la nueva columna está vacía.
--
-- Ejecutar en Supabase SQL o PostgreSQL (idempotente).

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS tipo_competencia TEXT;

-- Si aún no aplicaste la migración anterior, asegurá también categoría de edad:
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS categoria_edad TEXT;

UPDATE public.torneos
SET tipo_competencia = NULLIF(TRIM(genero_competencia), '')
WHERE (tipo_competencia IS NULL OR TRIM(tipo_competencia) = '')
  AND genero_competencia IS NOT NULL
  AND TRIM(genero_competencia) <> '';

COMMENT ON COLUMN public.torneos.tipo_competencia IS
  'Competencia del torneo: masculino | femenino | mixto (NULL = histórico). Legacy: genero_competencia.';
