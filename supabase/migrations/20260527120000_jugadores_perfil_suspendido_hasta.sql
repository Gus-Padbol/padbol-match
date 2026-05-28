-- Reputación por cancelaciones: suspensión temporal del jugador
ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS suspendido_hasta TIMESTAMPTZ;

COMMENT ON COLUMN public.jugadores_perfil.suspendido_hasta IS
  'Si es futuro, el jugador no puede hacer reservas hasta esa fecha (reputación por cancelaciones).';
