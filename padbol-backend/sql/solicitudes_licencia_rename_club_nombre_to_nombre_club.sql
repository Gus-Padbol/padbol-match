-- Migración: el backend y PostgREST usan la columna nombre_club en solicitudes_licencia.
-- Error típico si la tabla tiene club_nombre: "Could not find the club_nombre column ... in the schema cache"
-- (el cache refleja nombre_club; el insert enviaba club_nombre).
--
-- Si tu tabla aún tiene solo club_nombre, renombrá una vez:

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes_licencia'
      AND column_name = 'club_nombre'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes_licencia'
      AND column_name = 'nombre_club'
  ) THEN
    ALTER TABLE public.solicitudes_licencia RENAME COLUMN club_nombre TO nombre_club;
  END IF;
END $$;
