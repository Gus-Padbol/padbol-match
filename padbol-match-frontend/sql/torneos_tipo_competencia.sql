-- Copia de padbol-backend/sql/torneos_tipo_competencia.sql

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS tipo_competencia TEXT;

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS categoria_edad TEXT;

UPDATE public.torneos
SET tipo_competencia = NULLIF(TRIM(genero_competencia), '')
WHERE (tipo_competencia IS NULL OR TRIM(tipo_competencia) = '')
  AND genero_competencia IS NOT NULL
  AND TRIM(genero_competencia) <> '';

COMMENT ON COLUMN public.torneos.tipo_competencia IS
  'Competencia del torneo: masculino | femenino | mixto (NULL = histórico). Legacy: genero_competencia.';
