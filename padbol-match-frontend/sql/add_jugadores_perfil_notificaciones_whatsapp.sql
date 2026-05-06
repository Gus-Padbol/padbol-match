-- Opt-in WhatsApp: novedades de torneos y promociones (no invitaciones transaccionales).
ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS notificaciones_whatsapp boolean DEFAULT false;

COMMENT ON COLUMN public.jugadores_perfil.notificaciones_whatsapp IS
  'Si true, el jugador acepta WhatsApp de novedades/promos de torneo; invitaciones a equipo y reservas no dependen de esto.';
