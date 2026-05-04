-- Campos opcionales para formato Grupos + Knockout (creación / edición de torneo).
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS equipos_por_grupo integer;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS clasificados_por_grupo integer;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS mejores_terceros_clasificados integer;
