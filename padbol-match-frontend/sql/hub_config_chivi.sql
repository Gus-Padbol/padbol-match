-- Avatar del chatbot Chivi (fila singleton en hub_config).
-- Ejecutar en Supabase SQL Editor si no aplicás migraciones por CLI.

ALTER TABLE public.hub_config ADD COLUMN IF NOT EXISTS chivi_imagen_url text NULL;

COMMENT ON COLUMN public.hub_config.chivi_imagen_url IS
  'URL pública del avatar de Chivi (FAB del chat). Solo usado en la fila id=hub_chivi; vacío = /chivi.png en el frontend.';

INSERT INTO public.hub_config (id, orden, titulo, subtitulo, foto_url, activo, chivi_imagen_url)
VALUES ('hub_chivi', 50, 'Chivi', 'Avatar asistente chatbot', NULL, true, NULL)
ON CONFLICT (id) DO NOTHING;
