-- Ejecutar en Supabase SQL Editor (o psql) antes de desplegar la app.
-- Deportes que el jugador practica; usado por perfil, registro y chat IA.

ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS deportes_preferidos text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.jugadores_perfil.deportes_preferidos IS
  'Deportes de interés del jugador (claves: padbol, padel, tenis, pickleball, squash, futbol_5, futbol_7). Vacío = sin preferencias cargadas.';
