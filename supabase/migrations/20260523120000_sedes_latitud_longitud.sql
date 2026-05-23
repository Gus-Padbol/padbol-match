-- Coordenadas WGS84 para mapas embebidos en /sede/:id (prioridad sobre geocodificar dirección).
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS latitud numeric,
  ADD COLUMN IF NOT EXISTS longitud numeric;

-- La Meca Padbol Club (La Plata)
UPDATE public.sedes
SET latitud = -34.92105, longitud = -57.96505
WHERE id = 1;
