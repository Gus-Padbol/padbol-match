-- Columna real: imagen_url (renombrar si quedó foto_url en instalaciones anteriores).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_deporte_config'
      AND column_name = 'foto_url'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_deporte_config'
      AND column_name = 'imagen_url'
  ) THEN
    ALTER TABLE public.hub_deporte_config RENAME COLUMN foto_url TO imagen_url;
  END IF;
END $$;

ALTER TABLE public.hub_deporte_config ADD COLUMN IF NOT EXISTS imagen_url text NULL;
