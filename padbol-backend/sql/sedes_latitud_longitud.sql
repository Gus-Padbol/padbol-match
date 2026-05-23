-- Coordenadas WGS84 para mapas embebidos en /sede/:id (prioridad sobre geocodificar dirección).
-- Ejecutar en Supabase SQL Editor si la migración aún no corrió en prod.
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS latitud numeric,
  ADD COLUMN IF NOT EXISTS longitud numeric;

UPDATE public.sedes
SET latitud = -34.92105, longitud = -57.96505
WHERE id = 1;
