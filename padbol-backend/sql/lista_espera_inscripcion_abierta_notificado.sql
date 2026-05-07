-- Evita reenviar el aviso de “inscripción abierta” al mismo jugador en el mismo torneo.
ALTER TABLE public.lista_espera_torneos
  ADD COLUMN IF NOT EXISTS inscripcion_abierta_notificado_at timestamptz;

COMMENT ON COLUMN public.lista_espera_torneos.inscripcion_abierta_notificado_at IS
  'Momento en que se envió por WhatsApp el aviso de apertura de inscripción (idempotencia).';
