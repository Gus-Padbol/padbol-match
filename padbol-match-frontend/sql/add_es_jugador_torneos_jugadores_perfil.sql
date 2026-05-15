-- Opt-in de registro/edición: el jugador indica interés en participar en torneos.
-- lateralidad y nivel ya se usan en MiPerfil; se añaden por si el proyecto arrancó sin ellas.

ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS lateralidad TEXT,
  ADD COLUMN IF NOT EXISTS nivel TEXT,
  ADD COLUMN IF NOT EXISTS es_jugador_torneos BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jugadores_perfil.es_jugador_torneos IS
  'True si el jugador marcó participar en torneos (registro o edición). Campos lateralidad/nivel/pais pueden ir vacíos.';
