-- Supabase SQL Editor:
-- Extiende las franjas horarias JSONB con soporte para:
-- - franjas semanales por dias: { tipo: 'semanal', dias: ['lun','mar',...] }
-- - fechas especiales: { tipo: 'fecha_especial', fecha: 'YYYY-MM-DD' }
-- Mantiene compatibilidad con franjas existentes agregando tipo/dias por defecto.

ALTER TABLE sedes
  ADD COLUMN IF NOT EXISTS franjas_horarias JSONB DEFAULT '[]'::jsonb;

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
