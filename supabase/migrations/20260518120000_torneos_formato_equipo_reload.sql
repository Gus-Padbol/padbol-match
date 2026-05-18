-- BUG-05: columna formato_equipo + resync schema cache PostgREST
-- (Valores de app: singles | dobles | equipo_5 | equipo_7 — ver torneos_deporte_formato_equipo.sql)

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS formato_equipo text NOT NULL DEFAULT 'dobles';

COMMENT ON COLUMN public.torneos.formato_equipo IS 'Modalidad: singles | dobles | equipo_5 | equipo_7.';

ALTER TABLE public.torneos DROP CONSTRAINT IF EXISTS torneos_formato_equipo_chk;
ALTER TABLE public.torneos
  ADD CONSTRAINT torneos_formato_equipo_chk CHECK (
    formato_equipo IN ('singles', 'dobles', 'equipo_5', 'equipo_7')
  );

NOTIFY pgrst, 'reload schema';
