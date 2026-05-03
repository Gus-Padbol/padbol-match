-- Ejecutar en Supabase SQL Editor.
-- Inserciones desde el backend (service role). Ajustar RLS según política del proyecto.

CREATE TABLE IF NOT EXISTS sedes_pendientes (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  estado TEXT DEFAULT 'pendiente',
  motivo_rechazo TEXT,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  pais TEXT,
  latitud NUMERIC,
  longitud NUMERIC,
  horario_apertura TEXT,
  horario_cierre TEXT,
  precio_base NUMERIC,
  moneda TEXT DEFAULT 'ARS',
  whatsapp TEXT,
  email_contacto TEXT,
  numero_licencia TEXT,
  fecha_contrato DATE,
  tipo_licencia TEXT DEFAULT 'club_afiliado',
  licenciatario_nombre TEXT,
  licenciatario_email TEXT,
  licenciatario_telefono TEXT,
  licenciatario_pais TEXT
);

CREATE INDEX IF NOT EXISTS idx_sedes_pendientes_estado ON sedes_pendientes (estado);
CREATE INDEX IF NOT EXISTS idx_sedes_pendientes_created_at ON sedes_pendientes (created_at DESC);

COMMENT ON TABLE sedes_pendientes IS 'Altas de sede solicitadas por admin_nacional (pendiente) o borrador super_admin; aprobación por super_admin.';
