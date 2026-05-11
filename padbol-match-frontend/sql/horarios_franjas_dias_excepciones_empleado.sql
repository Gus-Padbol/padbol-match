-- Supabase SQL Editor:
-- Extiende las franjas horarias JSONB con soporte para:
-- - franjas semanales por dias: { tipo: 'semanal', dias: ['lun','mar',...] }
-- - fechas especiales: { tipo: 'fecha_especial', fecha: 'YYYY-MM-DD' }
-- Mantiene compatibilidad con franjas existentes agregando tipo/dias por defecto.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE sedes
  ADD COLUMN IF NOT EXISTS franjas_horarias JSONB DEFAULT '[]'::jsonb;

ALTER TABLE sedes
  ADD COLUMN IF NOT EXISTS cancelacion_horas_minimas INTEGER NOT NULL DEFAULT 3;

UPDATE sedes
SET franjas_horarias = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(item) = 'object' THEN
          item
          || jsonb_build_object('tipo', COALESCE(NULLIF(item->>'tipo', ''), 'semanal'))
          || CASE
            WHEN item ? 'dias' THEN '{}'::jsonb
            ELSE jsonb_build_object('dias', jsonb_build_array('lun','mar','mie','jue','vie','sab','dom'))
          END
        ELSE item
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(franjas_horarias, '[]'::jsonb)) AS item
)
WHERE jsonb_typeof(COALESCE(franjas_horarias, '[]'::jsonb)) = 'array';

CREATE TABLE IF NOT EXISTS horarios_excepciones (
  id BIGSERIAL PRIMARY KEY,
  sede_id BIGINT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  nombre TEXT,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  precio NUMERIC,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS horarios_excepciones_sede_fecha_idx
  ON horarios_excepciones (sede_id, fecha);

-- Rol operativo para personal de club. Debe usarse con alcance='sede' y sede_id.
ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin', 'admin_nacional', 'admin_club', 'empleado'));

CREATE TABLE IF NOT EXISTS partidos_abiertos (
  id BIGSERIAL PRIMARY KEY,
  reserva_id BIGINT REFERENCES reservas(id) ON DELETE SET NULL,
  sede_id BIGINT REFERENCES sedes(id) ON DELETE SET NULL,
  sede_nombre TEXT NOT NULL,
  cancha INTEGER NOT NULL,
  deporte TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 90,
  nivel TEXT,
  jugadores_requeridos INTEGER NOT NULL,
  jugadores_confirmados JSONB NOT NULL DEFAULT '[]'::jsonb,
  capitan_user_id UUID,
  capitan_email TEXT NOT NULL,
  capitan_nombre TEXT NOT NULL,
  capitan_foto_url TEXT,
  estado TEXT NOT NULL DEFAULT 'abierto',
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partidos_abiertos_estado_check CHECK (estado IN ('abierto', 'completo', 'cancelado', 'finalizado')),
  CONSTRAINT partidos_abiertos_deporte_check CHECK (deporte IN ('padbol', 'padel', 'pickleball', 'futbol_5', 'futbol_7')),
  CONSTRAINT partidos_abiertos_jugadores_check CHECK (jugadores_requeridos > 1)
);

CREATE INDEX IF NOT EXISTS partidos_abiertos_estado_fecha_idx
  ON partidos_abiertos (estado, fecha, hora);

CREATE INDEX IF NOT EXISTS partidos_abiertos_sede_fecha_idx
  ON partidos_abiertos (sede_id, fecha);

CREATE TABLE IF NOT EXISTS partidos_abiertos_solicitudes (
  id BIGSERIAL PRIMARY KEY,
  partido_id BIGINT NOT NULL REFERENCES partidos_abiertos(id) ON DELETE CASCADE,
  jugador_user_id UUID,
  jugador_email TEXT NOT NULL,
  jugador_nombre TEXT NOT NULL,
  jugador_foto_url TEXT,
  mensaje TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partidos_abiertos_solicitudes_estado_check CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  CONSTRAINT partidos_abiertos_solicitudes_unique UNIQUE (partido_id, jugador_email)
);

CREATE INDEX IF NOT EXISTS partidos_abiertos_solicitudes_partido_estado_idx
  ON partidos_abiertos_solicitudes (partido_id, estado);
