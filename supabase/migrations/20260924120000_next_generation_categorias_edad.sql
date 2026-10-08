-- Padbol Match — Categorías de edad juveniles (FIPA Next Generation) y adultas/familiares.
--
-- Idempotente. NO migra datos existentes: `sub_18` sigue siendo válido (compatibilidad histórica).
--
-- Valores soportados en `torneos.categoria_edad`:
--   Juveniles (Next Generation): u13 | u15 | u17
--   Adultas / familiares:        master_30 | master_40 | master_50
--   Abierta:                     open
--   Legado:                      sub_18
--
-- Las edades se calculan por fecha de nacimiento contra `torneos.fecha_corte_edad`
-- (si es NULL, se usa `fecha_inicio` y, en su defecto, la fecha actual).

-- 1) Fecha de corte de edad por competencia (nullable: los torneos históricos quedan sin corte).
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS fecha_corte_edad DATE;

-- 2) Marca explícita del programa (opcional). NULL = torneo regular.
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS programa TEXT;

-- 3) Documentación de valores admitidos. Sin CHECK a propósito: no romper filas históricas
--    ni bloquear valores futuros. La validación canónica vive en backend/frontend.
COMMENT ON COLUMN public.torneos.categoria_edad IS
  'Edad: u13 | u15 | u17 (Next Generation) | open | master_30 | master_40 | master_50 | sub_18 (legado)';
COMMENT ON COLUMN public.torneos.fecha_corte_edad IS
  'Fecha de corte para calcular la edad de los inscritos. NULL = usar fecha_inicio o la fecha actual.';
COMMENT ON COLUMN public.torneos.programa IS
  'NULL = torneo regular | next_generation = programa juvenil FIPA Next Generation.';

-- Rollback (reversión manual; no toca datos de categoria_edad):
--   COMMENT ON COLUMN public.torneos.categoria_edad IS 'Edad: sub_18 | open | master_40 | master_50';
--   ALTER TABLE public.torneos DROP COLUMN IF EXISTS fecha_corte_edad;
--   ALTER TABLE public.torneos DROP COLUMN IF EXISTS programa;
