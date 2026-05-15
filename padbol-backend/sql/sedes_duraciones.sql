-- Duraciones de reserva por sede con precio propio (tabla normalizada).
-- Ejecutar en Supabase SQL Editor o como migración.
-- Convive con las columnas legacy en `sedes` (precio_60min, precio_90min, precio_120min) hasta que la app migre por completo.

CREATE TABLE IF NOT EXISTS public.sedes_duraciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  duracion_minutos int NOT NULL,
  precio numeric NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (sede_id, duracion_minutos)
);

CREATE INDEX IF NOT EXISTS idx_sedes_duraciones_sede_id ON public.sedes_duraciones (sede_id);
CREATE INDEX IF NOT EXISTS idx_sedes_duraciones_sede_activo ON public.sedes_duraciones (sede_id) WHERE activo = true;

-- Ejemplo: sede id = 1 (ajustar sede_id según tu base).
INSERT INTO public.sedes_duraciones (sede_id, duracion_minutos, precio)
VALUES
  (1, 60, 22000),
  (1, 90, 30000),
  (1, 120, 40000)
ON CONFLICT (sede_id, duracion_minutos) DO NOTHING;
