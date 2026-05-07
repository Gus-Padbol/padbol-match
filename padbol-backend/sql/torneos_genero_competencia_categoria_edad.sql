-- Torneos: tipo de competencia (M/F/Mixto) y categoría de edad.
-- Ejecutar en Supabase SQL o PostgreSQL.

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS genero_competencia TEXT,
  ADD COLUMN IF NOT EXISTS categoria_edad TEXT;

COMMENT ON COLUMN public.torneos.genero_competencia IS 'Competencia: masculino | femenino | mixto (NULL = histórico / no especificado)';
COMMENT ON COLUMN public.torneos.categoria_edad IS 'Edad: sub_18 | open | master_40 | master_50 (NULL = histórico / no especificado)';

-- jugadores_perfil.genero ya existe (text). Valores usados por la app: masculino, femenino, otro.
