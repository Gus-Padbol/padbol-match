-- Supabase SQL Editor:
-- Notificaciones in-app para jugadores (campanita del hub).
--
-- Columnas: user_id, tipo, titulo, mensaje, leida, created_at, link
-- Tipos usados por el backend (texto libre; convención):
--   partido_solicitud | partido_solicitud_aceptada | partido_solicitud_rechazada
--   torneo_inscripcion_confirmada | resultado_partido | ranking_actualizado
--   reserva_confirmada | recordatorio_reserva | invitacion_torneo_dupla | general

CREATE TABLE IF NOT EXISTS notificaciones (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_user_created_idx
  ON notificaciones (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notificaciones_user_unread_idx
  ON notificaciones (user_id, leida, created_at DESC);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus notificaciones" ON notificaciones;
CREATE POLICY "Usuarios ven sus notificaciones"
  ON notificaciones
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios marcan sus notificaciones" ON notificaciones;
CREATE POLICY "Usuarios marcan sus notificaciones"
  ON notificaciones
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END $$;

ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;
