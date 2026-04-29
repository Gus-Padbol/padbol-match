-- Opción de privacidad: mostrar solo la cantidad de torneos jugados en el perfil público (default: no).
ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS mostrar_torneos_jugados boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jugadores_perfil.mostrar_torneos_jugados IS
  'Si true, el perfil público puede mostrar la cantidad de torneos con puntos; no expone nombres de torneos.';
