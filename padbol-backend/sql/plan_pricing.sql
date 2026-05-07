-- Planes de suscripción por cantidad de canchas (Supabase SQL Editor)
-- Ejecutar en public.

CREATE TABLE IF NOT EXISTS public.plan_pricing (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  canchas_min integer NOT NULL,
  canchas_max integer,
  precio_usd numeric(10, 2) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.plan_pricing (nombre, canchas_min, canchas_max, precio_usd)
VALUES
  ('Starter', 1, 3, 29.00),
  ('Pro', 4, 8, 69.00),
  ('Elite', 9, 15, 129.00),
  ('Enterprise', 16, NULL, 199.00);

-- Si ya ejecutaste este script antes, el INSERT duplicará filas; usá DELETE FROM plan_pricing; antes de reinsertar.

COMMENT ON TABLE public.plan_pricing IS 'Precio mensual USD por tramo de cantidad de canchas (editable super_admin)';
