-- Provincia / estado / región en solicitudes y sedes activas
ALTER TABLE sedes_pendientes ADD COLUMN IF NOT EXISTS provincia TEXT;
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS provincia TEXT;
