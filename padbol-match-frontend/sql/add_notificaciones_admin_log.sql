-- Supabase SQL Editor (no ejecutar desde la app; aplicar manualmente):
-- Log de notificaciones push enviadas por admins + tokens Expo para destinatarios.

CREATE TABLE IF NOT EXISTS notificaciones_admin_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  segmento JSONB NOT NULL DEFAULT '{}'::jsonb,
  cantidad_enviadas INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'enviado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_admin_log_admin_created_idx
  ON notificaciones_admin_log (admin_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);

COMMENT ON TABLE notificaciones_admin_log IS 'Auditoría de broadcasts push enviados desde el panel admin.';
COMMENT ON TABLE push_tokens IS 'Tokens Expo Push por usuario (registro desde app móvil).';
