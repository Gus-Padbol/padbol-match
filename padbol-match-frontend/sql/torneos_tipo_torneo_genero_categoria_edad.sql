-- Padbol Match — columnas solicitadas para torneos (género de competencia + edad).
-- Ejecutar en Supabase SQL Editor (idempotente). Copia alineada con padbol-backend/sql/torneos_tipo_torneo_genero_categoria_edad.sql
--
-- Nota: `tipo_torneo` en esta tabla es el FORMATO del torneo (round_robin, grupos_knockout, etc.).
--       `tipo_torneo_genero` y `tipo_competencia` guardan Masculino / Femenino / Mixto (la app escribe ambos).

ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS tipo_torneo_genero TEXT DEFAULT 'masculino';
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS categoria_edad TEXT DEFAULT 'open';

UPDATE public.torneos t
SET tipo_torneo_genero = COALESCE(NULLIF(TRIM(t.tipo_competencia), ''), NULLIF(TRIM(t.genero_competencia), ''), 'masculino')
WHERE tipo_torneo_genero IS NULL OR TRIM(tipo_torneo_genero) = '';

UPDATE public.torneos t
SET tipo_competencia = TRIM(t.tipo_torneo_genero)
WHERE (tipo_competencia IS NULL OR TRIM(tipo_competencia) = '')
  AND t.tipo_torneo_genero IS NOT NULL
  AND TRIM(t.tipo_torneo_genero) <> '';

UPDATE public.torneos SET categoria_edad = 'open' WHERE categoria_edad IS NULL OR TRIM(categoria_edad) = '';

COMMENT ON COLUMN public.torneos.tipo_torneo_genero IS 'Competencia: masculino | femenino | mixto (espejo de tipo_competencia en escrituras nuevas).';
COMMENT ON COLUMN public.torneos.categoria_edad IS 'Edad: sub_18 | open | master_40 | master_50';
