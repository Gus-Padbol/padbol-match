-- Campos opcionales para gestión de canchas por sede (panel admin + reservas).
-- Ejecutar en el SQL Editor de Supabase si aún no existen.

ALTER TABLE public.canchas ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE public.canchas ADD COLUMN IF NOT EXISTS orden integer;

-- Rellenar orden estable (1..n por sede) donde falte, según id.
UPDATE public.canchas c
SET orden = s.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY sede_id ORDER BY id) AS rn
  FROM public.canchas
  WHERE orden IS NULL
) s
WHERE c.id = s.id;
